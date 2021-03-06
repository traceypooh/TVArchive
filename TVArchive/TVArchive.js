/* eslint-disable semi */
/* eslint-disable max-classes-per-file */

// uncomment one:
// eslint-disable-next-line  no-console
const log = console.log.bind(console)
// const log = (() => {})

class $ { } // <= some tragically missing XHR methods get added below

class TVA {
  // tvOS app 'TVArchive' - leverages TVML/TVJS
  // xxx loading interstitials
  // xxx clear prior alerts
  // xxx last night's shows - based on history and favoriting
  // xxx cache
  // xxx oneupTemplate for playing 3m clip w/ CC
  // click a show goes to carousel w/ each minute's thumb + CC
  //   selecting will play 2 mins _UNLESS_ you have privs -- in which case
  //   it starts there but goes to end

  // https://developer.apple.com/library/archive/documentation/TVMLKitJS/Conceptual/TVMLProgrammingGuide/PlayingVideo.html#//apple_ref/doc/uid/TP40016718-CH13-SW1
  // https://medium.com/airbnb-engineering/apple-tv-authentication-a156937ea211
  // https://stephenradford.me/oauth-login-on-tvos/
  // https://github.com/emadalam/atvjs

  /* global App navigationDocument getActiveDocument MediaItem Playlist Player */
  /* eslint no-continue: 0 */


  /**
   * returns (lowercased) whitelist of patterns in titles to look for
   */
  static show_patterns() {
    return [
      /anderson cooper/,
      /brian williams/,
      /chris hayes/,
      /chris matthews/,
      /convention/,
      /cuomo/,
      /debate/,
      /don lemon/,
      /hannity/,
      /ingraham/,
      /lawrence o'donnell/,
      /news/,
      /rachel maddow/,
      /tucker carlson/,
    ]
  }

  /**
   * returns channels and times of the main primetime for some of the top news networks
   */
  static channel_times() {
    return {
      MSNBCW: [
        '4:00pm',
        '5:00pm',
        '6:00pm',
        '7:00pm',
        '8:00pm',
      ],
      CNNW: [
        '5:00pm',
        '6:00pm',
        '7:00pm',
        '8:00pm',
        '9:00pm',
      ],
      FOXNEWSW: [
        '6:00pm',
        '7:00pm',
        '8:00pm',
        '9:00pm',
      ],
      KQED: [
        '6:00pm',
      ],
      BBCNEWS: [
        '5:00pm',
        '6:00pm',
      ],
    }
  }


  /**
   * Creates TV News shows carousels
   */
  constructor(options) {
    TVA.alert('Loading', 'News from last week primetime', true, null)
    TVA.options = options

    TVA.set_user(null)
    TVA.last_week(null)
  }


  /**
   * Sets up search query for last week's primetime shows
   * @param {string} str - optional message to console.log() at start
   */
  static last_week(str) {
    if (str)
      log(str)
    const rite = new Date().getTime() / 1000
    const left = rite - (7 * 86400)

    const l = new Date(left * 1000).toISOString().replace(/\.\d\d\dZ/, '').replace(/[^\d]/g, '')
    const r = new Date(rite * 1000).toISOString().replace(/\.\d\d\dZ/, '').replace(/[^\d]/g, '')

    const chans = `contributor:${Object.keys(TVA.channel_times()).join(' OR contributor:')}`
    const query = `(${chans}) AND scandate:%5B${l} TO ${r}%5D AND format:SubRip AND format:h.264`.replace(/ /g, '+')

    TVA.search_url = `https://archive.org/advancedsearch.php?${[
      `q=${query}`,
      'fl[]=identifier,title', // ,reported_server,reported_dir
      'sort[]=identifier+desc',
      'rows=9999',
      'scope=all',
      'output=json'].join('&')}`
    $.getJSON(TVA.search_url, TVA.search_results_to_carousels)
  }


  /**
   * Takes search results and creates video carousels
   *
   * @param {string} json - JSON reply from search REST API
   */
  static search_results_to_carousels(json) {
    if (!json.response) {
      // retry for less results
      const url = TVA.search_url
      TVA.search_url = TVA.search_url.replace(/&scope=all/, '')
      if (url !== TVA.search_url)
        $.getJSON(TVA.search_url, TVA.search_results_to_carousels)

      return
    }


    const { docs } = json.response

    const channel_times = TVA.channel_times()
    const patterns = TVA.show_patterns()
    const map = {}
    for (const show of docs) {
      // eslint-disable-next-line  guard-for-in
      for (const ch in channel_times) {
        if (!show.identifier.startsWith(ch))
          continue // show isnt for this channel

        // eslint-disable-next-line  guard-for-in
        for (const start of channel_times[ch]) {
          const mat = ` ${start}-`
          if (show.title.indexOf(mat) < 0)
            continue // show isnt in our primetime whitelist - wrong start time

          // eslint-disable-next-line  guard-for-in
          for (const pattern of patterns) {
            if (show.title.toLowerCase().match(pattern)) {
              // log(show.title, 'v', pattern)
              const parts = show.title.split(/:/)
              const title = (parts.length > 4
                // expected case - go from/to:
                //  Cities Tour : CSPAN : February 21, 2020 6:50pm-8:03pm EST
                //  Cities Tour
                ? parts.reverse().splice(4).reverse().join(':')
                : show.title
              );
              // create array if !exist yet and push element into it
              (map[ch] = map[ch] || []).push({
                identifier: show.identifier,
                title: `${TVA.identifierDay(show.identifier)} ${start.replace(/:\d\d/, '')} ${title.trim()}`,
              })
              break
            }
          }
        }
      }
    }
    // TVA.alert('map', JSON.stringify(map))

    let vids = ''

    const args = (TVA.user.editor ? '&amp;tunnel=1' : '&amp;start=0&amp;end=180')

    // eslint-disable-next-line  guard-for-in
    for (const ch in TVA.channel_times()) {
      const network = ch.replace(/W$/, '').replace(/KQED/, 'PBS').replace(/NEWS/, ' News')
      TVA.alert(network, '', true, null)

      if (typeof map[ch] === 'undefined')
        continue

      const shows = map[ch]
      // TVA.alert(network, JSON.stringify(shows))

      vids += `
  <shelf>
    <header>
      <title>${network}</title>
    </header>
    <section>
  `
      // eslint-disable-next-line  guard-for-in
      for (const show of shows)
        vids += TVA.videoTile(show, args)

      vids += `
    </section>
  </shelf>
  `
    }

    if (TVA.priorDoc)
      navigationDocument.popToDocument(TVA.priorDoc)

    const login = (typeof TVA.user.screenname === 'undefined' ?
      'Login to archive.org' :
      `Hello ${TVA.user.screenname}`
    )

    const img = (typeof TVA.user.itemname === 'undefined' ?
      'resource://login.png' :
      `https://archive.org/services/img/${TVA.user.itemname}`
    )

    TVA.render(`
  <document>
    <stackTemplate>
      <banner>
        <title>Internet Archive TV News - Last Week</title>
      </banner>
      <collectionList>
        <shelf>
          <header>
            <title>Options</title>
          </header>
          <section>
            <lockup onselect="TVA.search()">
              <img src="resource://search.png" width="100" height="100"/>
              <title>Search</title>
              <description>Search week's captions</description>
            </lockup>
            <lockup onselect="TVA.username()">
              <img src="${img}" width="100" height="100"/>
              <title>Login</title>
              <description>${login}</description>
            </lockup>
            <lockup onselect="TVA.favorites()">
              <img src="resource://favorite.png" width="100" height="100" padding="25"/>
              <title>Favorites</title>
              <description>Archive favorite videos</description>
            </lockup>
          </section>
        </shelf>
        ${vids}
      </collectionList>
    </stackTemplate>
  </document>`, null)
  }


  /**
   * Sets .user hashamp with some info if they're logged in
   * @param {function} callback_in - optional callback to invoke when done
   */
  static set_user(callback_in) {
    // get some basic user account information
    const XAUTHN = 'https://archive.org/services/xauthn/?op'
    const EDITOR = 'tvarchive'

    TVA.user = {}

    const callback = callback_in || log

    const chk = (xhr) => {
      if (xhr.status !== 200)
        return callback('bad response')
      try {
        const r = JSON.parse(xhr.responseText)
        if (
          r.success  &&  r.values.passed  &&  r.values.passed.length  &&
          r.values.passed.includes(EDITOR)
        ) {
          TVA.user.editor = true
          return callback('editor')
        }
      } catch (e) {
        return callback('chk() json parse fail')
      }
      return callback('basic')
    }

    const get_account_info = (xhr) => {
      if (xhr.status !== 200)
        return callback('bad response')
      log('checked user')
      try {
        const ret = JSON.parse(xhr.responseText)
        if (ret.success  &&  ret.values.verified  &&  !ret.values.locked) {
          log('user admin')
          TVA.user = ret.values

          // now see if they have editorial abilities
          $.post(`${XAUTHN}=chkprivs`, `itemname=${TVA.user.itemname}&privs=${EDITOR}`, chk)
          return false
        }
      } catch (e) {
        return callback('get_account_info() json parse fail')
      }
      return callback('user account issue')
    }

    const get_screenname = (json) => {
      TVA.user.screenname = (json  &&  json.length ? json[0].userid : '')
      if (TVA.user.screenname !== '') {
        // now get more user account info
        log('logged in', TVA.user.screenname)
        $.post(`${XAUTHN}=info`, `itemname=${TVA.user.screenname}`, get_account_info)
      } else {
        callback('not logged in')
      }
    }

    // kinda cheesy, but this will both tell us if the user is logged into archive.org and
    // we can find their screenname so long as they have 1+ favorite already
    $.getJSON(
      'https://archive.org/bookmarks.php?output=json',
      get_screenname,
      () => callback('doesnt seem to be logged in'),
    )
    return true
  }


  /**
   * Plays a video
   * @param {string} videourl - url for video
   * @param {string} title
   * eslint-disable-next-line  no-unused-vars */
  static playVideo(videourl, title) {
    const singleVideo = new MediaItem('video', videourl)
    singleVideo.title = title
    const videoList = new Playlist()
    videoList.push(singleVideo)
    const myPlayer = new Player()
    myPlayer.playlist = videoList
    myPlayer.play()
  }


  /**
   * Returns timestamp (unix epoch based) in _milliseconds_ for the identifier
   * @param {string} id - item identifier
   */
  static identifierTS(id) {
    const ymd = id.split(/_/)[1]
    const hms = id.split(/_/)[2]

    return Date.parse(`${ymd.substr(0, 4)}-${ymd.substr(4, 2)}-${ymd.substr(6, 2)}T${hms.substr(0, 2)}:${hms.substr(2, 2)}:${hms.substr(4, 2)}`)
  }


  /**
   * Returns short name of day for identifier, eg: 'Mon'
   * @param {string} id - item identifier
   */
  static identifierDay(id) {
    const ts = TVA.identifierTS(id)
    const date = new Date(ts)
    const timeZone = (id.startsWith('BBCNEWS') ? 'UTC' : 'America/Los_Angeles')
    return date.toLocaleString('en-US', { timeZone, weekday: 'short' })
  }


  /**
   * Renders a page asking for Internet Archive account username
   */
  static username() {
    $.getJSON('https://archive.org/account/login.php', () => {}, (resp) => {
      if (resp.status === 200)
        log('testcookie _should_ be set now..')
    })

    TVA.render(`
<document>
  <formTemplate>
    <banner>
      <img src="https://archive.org/images/glogo.png" width="79" height="79"/>
      <description>
        Log in to Internet Archive account to see your Archive favorites
      </description>
    </banner>
    <textField keyboardType="emailAddress">
      dianaprince@example.com
    </textField>
    <footer>
      <button onselect="TVA.password()">
        <text>Submit</text>
      </button>
    </footer>
  </formTemplate>
</document>`, null)
  }


  /**
   * Renders a page asking for Internet Archive account password
   */
  static password() {
    const doc = navigationDocument.documents[navigationDocument.documents.length - 1]
    const e = doc.getElementsByTagName('textField').item(0)
    const val = e.getFeature('Keyboard').text

    TVA.render(`
<document>
  <formTemplate>
    <banner>
      <img src="https://archive.org/images/glogo.png" width="79" height="79"/>
      <description>
        Hello ${val}, enter your Internet Archive account password
      </description>
    </banner>
    <textField data-username="${val}" secure="true" isSecureTextEntry="true">
      password
    </textField>
    <footer>
      <button onselect="TVA.login()">
        <text>Login</text>
      </button>
    </footer>
  </formTemplate>
</document>`, null)
  }


  /**
   * Submits login request to Internt Archive
   */
  static login() {
    const doc = navigationDocument.documents[navigationDocument.documents.length - 1]
    const e = doc.getElementsByTagName('textField').item(0)
    const user = encodeURIComponent(e.getAttribute('data-username'))
    const pass = encodeURIComponent(e.getFeature('Keyboard').text)

    const dataString = `username=${user}&password=${pass}&remember=CHECKED&action=login&submit=Log+in`

    $.post('https://archive.org/account/login.php', dataString, (xhr) => {
      // https://developer.apple.com/documentation/tvmljs/xmlhttprequest
      // TVA.alert(TVA.amp(dataString))
      // TVA.alert(xhr.getAllResponseHeaders())
      if (xhr.status !== 200) {
        TVA.user = {}
        TVA.alert(`server responded with non-success status: ${xhr.status}`)
        return
      }

      // if (xhr.responseText.indexOf('Your browser does not appear to support cookies'))
      // return TVA.alert('testcookie set/send problem')

      // debugger
      // return TVA.alert(TVA.amp(xhr.responseText).replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      TVA.set_user(TVA.last_week)
    })
  }


  /**
   * Renders a page with user's favorite Internet Archive videos
   */
  static favorites() {
    $.getJSON(
      'https://archive.org/bookmarks.php?output=json',
      (faves) => {
        let vids = ''

        if (!faves.length) {
          TVA.alert(
            'Make some Favorites!',
            'Open a browser with https://archive.org, login, and start making some favorite and they will then show up here',
            null,
            null,
          )
        }

        for (const fave of faves) {
          if (fave.mediatype !== 'movies')
            continue
          log(fave)
          vids += TVA.videoTile(fave, '')
        }

        TVA.render(`
<document>
  <stackTemplate>
    <banner>
      <title>Your Favorite Videos</title>
    </banner>
    <collectionList>
      <grid>
        <section>
          ${vids}
        </section>
      </grid>
    </collectionList>
  </stackTemplate>
</document>`, null)
      },
      () => {
        TVA.alert('You likely need to login first', undefined, undefined, true)
      },
    )
  }


  /**
   * Renders a page for a user to search captions
   */
  static search() {
    TVA.render(`
<document>
  <formTemplate>
    <banner>
      <img src="https://archive.org/images/glogo.png" width="79" height="79"/>
      <description>
        Search TV News captions from last week
      </description>
    </banner>
    <textField>
      search captions
    </textField>
    <footer>
      <button onselect="TVA.search_results()">
        <text>Search</text>
      </button>
    </footer>
  </formTemplate>
</document>`, null)
  }


  /**
   * Issues user's caption search and shows results
   */
  static search_results() {
    const doc = navigationDocument.documents[navigationDocument.documents.length - 1]
    const e = doc.getElementsByTagName('textField').item(0)
    const search = e.getFeature('Keyboard').text

    // search last week, primetime, over our channels of interest
    const rite = new Date().getTime()
    const left = rite - (7 * 86400 * 1000)
    const l = new Date(left).toISOString().substr(0, 10)
    const r = new Date(rite).toISOString().substr(0, 10)
    log(l, ' to ', r)

    // stick with just our channels of interest
    const chans = `contributor:${Object.keys(TVA.channel_times()).join(' OR contributor:')}`

    // stick with primetime, 5-11pm
    const primetime = []
    for (const n of [...Array(7).keys()]) {
      primetime.push(`title:"${n + 5}pm"`)
      primetime.push(`title:"${n + 5}:30pm"`)
    }

    const query = `(${search}) AND (${chans}) AND (${primetime.join(' OR ')})`
    const url = `https://archive.org/tv?output=json&and%5B%5D=publicdate:%5B${l}+TO+${r}%5D&q=${encodeURIComponent(query)}`
    log(url)

    $.getJSON(url, (response) => {
      let vids = ''
      for (const hit of response) {
        log(hit)
        const vid = (hit.video
          .replace(/&ignore=x.mp4/, '')
          // boost the sample to up to 3 minutes
          .replace(/t=([\d.]+)\/[\d.]+/, (x, m) => `t=${m}/${180 + parseInt(m, 10)}`)
        )
        vids += TVA.videoTile2(`https:${hit.thumb}`, vid, TVA.amp(hit.title)) // xxx .snip => description
      }
      log(vids)
      // debugger

      TVA.render(`
<document>
  <stackTemplate>
    <banner>
      <title>Search results for: ${TVA.amp(search)}</title>
    </banner>
    <collectionList>
      <grid>
        <section>
          ${vids}
        </section>
      </grid>
    </collectionList>
  </stackTemplate>
</document>`, null)
    }, null)
  }


  /**
   * Convenience function inserts alert template, to present messages/errors to the user.
   * @param {string} title
   * @param {string} description
   * @param {boolean} replacePrior
   */
  static alert(title, description, replacePrior, noPop) {
    TVA.render(`<?xml version="1.0" encoding="UTF-8"?>
  <document>
    <alertTemplate>
      <title>${title}</title>
      <description>${typeof description === 'undefined' ? '' : description}</description>
    </alertTemplate>
  </document>`, replacePrior)
    if (!noPop)
      navigationDocument.popDocument() // clear the 'document' from any 'back' behaviour
  }

  /**
   * Renders markup to screen
   * @param {string} ml of TVML to render to screen
   * @param {boolean} replacePrior
   */
  static render(ml, replacePrior) {
    const templateParser = new DOMParser()
    const parsedTemplate = templateParser.parseFromString(ml, 'application/xml')
    if (0  &&  replacePrior  &&  TVA.priorDoc) {
      const currentDoc = getActiveDocument()
      navigationDocument.replaceDocument(parsedTemplate, currentDoc) // TVA.priorDoc) // xxx
    } else {
      navigationDocument.pushDocument(parsedTemplate)
    }
    TVA.priorDoc = parsedTemplate // xxx
  }

  /**
   * Renders a video tile (clickable image and title)
   * @param {array} map
   * @param {string} args
   */
  static videoTile(map, args) {
    const vid = `https://archive.org/download/${map.identifier}/format=h.264${args}`
    return `
  <lockup onselect="TVA.playVideo('${vid}', '${map.identifier}')">
    <img src="https://archive.org/services/img/${map.identifier}" width="360" height="248"/>
    <title>${TVA.amp(map.title)}</title>
  </lockup>`
  }

  /**
   *
   * @param {string} vid url
   * @param {string} thumb url
   * @param {string} title
   */
  static videoTile2(thumb, vid, title) {
    return `
  <lockup onselect="TVA.playVideo('${vid}', '${title}')">
    <img src="${thumb}" width="360" height="248"/>
    <title>${title}</title>
  </lockup>`
  }


  /**
   * Replaces (often 'naked') '&' chars with markup safe '&amp;'
   * @param {string} str
   */
  static amp(str) {
    return str.replace(/&/g, '&amp;')
  }
}


/**
 * Like $.getJSON()
 * @param {string} url - REST API url that returns JSON
 * @param {function} callback - function to call with results
 * @param {function} error_callback - optional function to call with error response
 */
$.getJSON = (url, callback, error_callback) => {
  const xhr = new XMLHttpRequest()
  xhr.addEventListener('load', (response) => {
    try {
      // debugger
      const json = JSON.parse(response.target.responseText)
      callback(json)
    } catch (e) {
      log(`getJSON(${url}) failed to parse JSON`)
      if (error_callback)
        error_callback(response)
    }
  }, false)
  log('FETCHING', url)
  xhr.open('GET', url, true)
  xhr.responseType = 'document'
  xhr.send()
}


/**
 * Like $.post()
 * @param {string} url - REST API url that returns JSON
 * @param {string} data - string to send on POST body
 * @param {function} callback - function to call with results
 */
$.post = (url, data, callback) => {
  const xhr = new XMLHttpRequest()
  // Send the proper header information along with the request
  xhr.addEventListener('load', () => callback(xhr), false)
  xhr.open('POST', url, true)
  xhr.withCredentials = true
  xhr.responseType = 'document'
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  log('POSTING', url)

  xhr.send(data)
}


// entry point from swift app
App.onLaunch = (options) => new TVA(options)
