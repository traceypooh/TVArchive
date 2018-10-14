
// uncomment one:
// eslint-disable-next-line  no-console
const log = console.log.bind(console)
// const log = (() => {})

class $ { }

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

  /* global App navigationDocument getActiveDocument MediaItem Playlist Player $ */
  /* eslint no-continue: 0 */


  static SHOWS() {
    return {
      MSNBCW: {
        '4:00pm': ['Hardball With Chris Matthews'],
        '5:00pm': ['All In With Chris Hayes'],
        '6:00pm': ['The Rachel Maddow Show'],
        '7:00pm': ["The Last Word With Lawrence O'Donnell"],
        '8:00pm': ['The 11th Hour With Brian Williams'],
      },
      CNNW: {
        '5:00pm': ['Anderson Cooper 360'],
        '6:00pm': ['Cuomo Primetime'],
        '7:00pm': ['Cuomo Primetime', 'CNN Tonight With Don Lemon'],
        '8:00pm': ['CNN Tonight With Don Lemon', 'Anderson Cooper 360'],
        '9:00pm': ['Anderson Cooper 360'],
      },
      FOXNEWSW: {
        '6:00pm': ['Hannity'],
        '7:00pm': ['The Ingraham Angle'],
        '8:00pm': ['Fox News @ Night With Shannon Bream'],
        '9:00pm': ['Tucker Carlson Tonight'],
      },
      KQED: {
        '6:00pm': ['PBS NewsHour'],
      },
      BBCNEWS: {
        '5:00pm': ['BBC News at Five'],
        '6:00pm': ['BBC News at Six'],
      },
    }
  }


  /**
   * Creates TV News shows carousels
   */
  constructor(options) {
    TVA.alert('Loading', 'News from last week primetime', true)
    TVA.options = options

    TVA.set_user()
    TVA.last_week()
  }

  static last_week(str) {
    if (str)
      log(str)
    const rite = new Date().getTime() / 1000
    const left = rite - (7 * 86400)

    const l = new Date(left * 1000).toISOString().replace(/\.\d\d\dZ/, '').replace(/[^\d]/g, '')
    const r = new Date(rite * 1000).toISOString().replace(/\.\d\d\dZ/, '').replace(/[^\d]/g, '')

    const chans = `contributor:${Object.keys(TVA.SHOWS()).join(' OR contributor:')}`
    const query = `(${chans}) AND scandate:%5B${l} TO ${r}%5D AND format:JSON AND format:h.264`.replace(/ /g, '+')
    const url = `https://www-tracey.archive.org/advancedsearch.php?${[ // xxx www-tracey
      `q=${query}`,
      'fl[]=identifier,title', // ,reported_server,reported_dir
      'sort[]=identifier+desc',
      'rows=9999',
      'contentLength=1',
      'output=json'].join('&')}`
    $.getJSON(url, TVA.search_results_to_carousels)
  }

  /**
   * Takes search results and creates video carousels
   *
   * @param {string} response - JSON reply from search REST API
   */
  static search_results_to_carousels(json) {
    // TVA.alert('PARSE', response)
    const { docs } = json.response

    const SHOWS = TVA.SHOWS()
    const map = {}
    for (const show of docs) {
      // eslint-disable-next-line  guard-for-in
      for (const ch in SHOWS) {
        if (!show.identifier.startsWith(ch))
          continue // show isnt for this channel

        // eslint-disable-next-line  guard-for-in
        for (const start in SHOWS[ch]) {
          const mat = ` ${start}-`
          if (show.title.indexOf(mat) < 0)
            continue // show isnt in our primetime whitelist - wrong start time

          for (const title of SHOWS[ch][start]) {
            // TVA.alert(`${show.title} -v- ${title}`, mat)
            if (!show.title.startsWith(title))
              continue // show isnt in our primetime whitelist - wrong title

            // create array if !exist yet and push element into it
            (map[ch] = map[ch] || []).push({
              identifier: show.identifier,
              title: `${TVA.identifierDay(show.identifier)} ${start.replace(/:\d\d/, '')} ${title}`,
            })
          }
        }
      }
    }
    // TVA.alert('map', JSON.stringify(map))

    let vids = ''

    const args = (TVA.user.editor ? '&amp;tunnel=1' : '&amp;start=0&amp;end=180')

    // eslint-disable-next-line  guard-for-in
    for (const ch in TVA.SHOWS()) {
      const network = ch.replace(/W$/, '').replace(/KQED/, 'PBS').replace(/NEWS/, ' News')
      TVA.alert(network, '', true)

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

    TVA.render(`
  <document>
    <stackTemplate>
      <banner>
        <title>TV News Archive - Last Week</title>
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
              <img src="resource://login.png" width="100" height="100"/>
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
  </document>`)
  }


  static set_user(callback) {
    // get some basic user account information
    const XAUTHN = 'https://archive.org/services/xauthn/?op'
    const EDITOR = 'tvarchive'

    TVA.user = {}

    if (!callback)
      callback = log

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
          TVA.fetchPOST(`${XAUTHN}=chkprivs`, `itemname=${TVA.user.itemname}&privs=${EDITOR}`, chk)
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
        TVA.fetchPOST(`${XAUTHN}=info`, `itemname=${TVA.user.screenname}`, get_account_info)
      } else {
        callback('not logged in')
      }
    }

    // kinda cheesy, but this will both tell us if the user is logged into archive.org and
    // we can find their screenname so long as they have 1+ favorite already
    $.getJSON(
      'https://archive.org/bookmarks.php?output=json',
      get_screenname,
      () => {
        callback('doesnt seem to be logged in')
      }
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
</document>`)
  }


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
</document>`)
  }


  static login() {
    const doc = navigationDocument.documents[navigationDocument.documents.length - 1]
    const e = doc.getElementsByTagName('textField').item(0)
    const user = encodeURIComponent(e.getAttribute('data-username'))
    const pass = encodeURIComponent(e.getFeature('Keyboard').text)

    const dataString = `username=${user}&password=${pass}&remember=CHECKED&action=login&submit=Log+in`

    TVA.fetchPOST('https://archive.org/account/login.php', dataString, (xhr) => {
      // https://developer.apple.com/documentation/tvmljs/xmlhttprequest
      // TVA.alert(dataString.replace(/&/g, '&amp;'))
      // TVA.alert(xhr.getAllResponseHeaders())
      if (xhr.status !== 200) {
        TVA.user = {}
        return TVA.alert(`server responded with non-success status: ${xhr.status}`)
      }

      // if (xhr.responseText.indexOf('Your browser does not appear to support cookies'))
      // return TVA.alert('testcookie set/send problem')

      // debugger
      // return TVA.alert(TVA.amp(xhr.responseText).replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      TVA.set_user(TVA.last_week)
    })
  }


  static favorites() {
    $.getJSON(
      'https://archive.org/bookmarks.php?output=json',
      (faves) => {
        let vids = ''

        if (!faves.length) {
          TVA.alert(
            'Make some Favorites!',
            'Open a browser with https://archive.org, login, and start making some favorite and they will then show up here',
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
</document>`)
      },
      () => {
        TVA.alert('You likely need to login first', undefined, undefined, true)
      },
    )
  }


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
</document>`)
  }


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
    const chans = `contributor:${Object.keys(TVA.SHOWS()).join(' OR contributor:')}`

    // stick with primetime, 5-11pm
    const primetime = []
    for (const n of [...Array(7).keys()]) {
      primetime.push(`title:"${n + 5}pm"`)
      primetime.push(`title:"${n + 5}:30pm"`)
    }

    const query = `(${search}) AND (${chans}) AND (${primetime.join(' OR ')})`
    const url = `https://www-tracey.archive.org/tv?output=json&and%5B%5D=publicdate:%5B${l}+TO+${r}%5D&q=${encodeURIComponent(query)}`
    log(url)

    $.getJSON(url, (response) => {
      let vids = ''
      for (const hit of response) {
        log(hit)
        vids += TVA.videoTile2(`https:${hit.thumb}`, hit.video.replace(/&ignore=x.mp4/, ''), hit.title.replace(/&/g, '&amp;')) // xxx .snip => description
      }
      log(vids)
      // debugger

      TVA.render(`
<document>
  <stackTemplate>
    <banner>
      <title>Search results for: ${search.replace(/&/g, '&amp;')}</title>
    </banner>
    <collectionList>
      <grid>
        <section>
          ${vids}
        </section>
      </grid>
    </collectionList>
  </stackTemplate>
</document>`)
    })
  }


  static fetchPOST(url, dataString, callback) {
    const xhr = new XMLHttpRequest()
    // Send the proper header information along with the request
    xhr.addEventListener('load', () => callback(xhr), false)
    xhr.open('POST', url, true)
    xhr.withCredentials = true
    xhr.responseType = 'document'
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    // TVA.alert('POSTING', url);

    xhr.send(dataString)
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


  static amp(str) {
    return str.replace(/&/g, '&amp;')
  }
}


/**
 * Like $.getJSON()
 * @param {string} url  - REST API url that returns JSON
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


// entry point from swift app
App.onLaunch = options => new TVA(options)
