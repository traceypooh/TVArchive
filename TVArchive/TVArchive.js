
class TVA {
  // tvOS app 'TVArchive' - leverages TVML/TVJS
  // xxx last night's shows - based on history and favoriting
  // xxx cache
  // click a show goes to carousel w/ each minute's thumb + CC
  //   selecting will play 2 mins _UNLESS_ you have privs -- in which case
  //   it starts there but goes to end

  // https://developer.apple.com/library/archive/documentation/TVMLKitJS/Conceptual/TVMLProgrammingGuide/PlayingVideo.html#//apple_ref/doc/uid/TP40016718-CH13-SW1
  // https://medium.com/airbnb-engineering/apple-tv-authentication-a156937ea211
  // https://stephenradford.me/oauth-login-on-tvos/
  // https://github.com/emadalam/atvjs

  /* global App navigationDocument MediaItem Playlist Player */
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
  constructor() {
    TVA.alert('Loading', 'News from last week primetime')

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
    TVA.fetchJSON(url, TVA.search_results_to_carousels)
  }


  /**
   * Takes search results and creates video carousels
   *
   * @param response string - JSON reply from search REST API
   */
  static search_results_to_carousels(response) {
    // TVA.alert('PARSE', response)
    const { docs } = JSON.parse(response).response

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
    // const startend = '&amp;start=0&amp;end=180' // xxx
    const args = '&amp;tunnel=1'

    // eslint-disable-next-line  guard-for-in
    for (const ch in TVA.SHOWS()) {
      const network = ch.replace(/W$/, '').replace(/KQED/, 'PBS').replace(/NEWS/, ' News')
      TVA.alert(network, '')

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
      for (const show of shows) {
        const vid = `https://archive.org/download/${show.identifier}/format=h.264${args}`
        vids += `
  <lockup onselect="TVA.playVideo('${vid}', '${show.identifier}')">
    <img src="https://archive.org/services/img/${show.identifier}" width="360" height="248"/>
    <title>${show.title}</title>
  </lockup>`
      }

      vids += `
    </section>
  </shelf>
  `
    }

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
              <img src="https://archive.org/images/search.png" width="100" height="100"/>
              <title>Search</title>
              <description>Search captions from last week</description>
            </lockup>
            <lockup onselect="TVA.username()">
              <img src="https://archive.org/images/person.png" width="100" height="100"/>
              <title>Login</title>
              <description>Login with your archive.org account</description>
            </lockup>
            <lockup onselect="TVA.favorites()">
              <img src="https://archive.org/images/star.png" width="100" height="100" padding="25"/>
              <title>Favorites</title>
              <description>Once logged in, see your Internet Archive favorite videos</description>
            </lockup>
          </section>
        </shelf>
        ${vids}
      </collectionList>
    </stackTemplate>
  </document>`)
  }


  /**
   * Plays a video
   * @param videourl string - url for video
   * @param identifier string - item identifier
   * eslint-disable-next-line  no-unused-vars */
  static playVideo(videourl, identifier) {
    const singleVideo = new MediaItem('video', videourl)
    singleVideo.title = identifier
    const videoList = new Playlist()
    videoList.push(singleVideo)
    const myPlayer = new Player()
    myPlayer.playlist = videoList
    myPlayer.play()
  }


  /**
   * Returns timestamp (unix epoch based) in _milliseconds_ for the identifier
   * @param id string - item identifier
   */
  static identifierTS(id) {
    const ymd = id.split(/_/)[1]
    const hms = id.split(/_/)[2]

    return Date.parse(`${ymd.substr(0, 4)}-${ymd.substr(4, 2)}-${ymd.substr(6, 2)}T${hms.substr(0, 2)}:${hms.substr(2, 2)}:${hms.substr(4, 2)}`)
  }


  /**
   * Returns short name of day for identifier, eg: 'Mon'
   * @param id string - item identifier
   */
  static identifierDay(id) {
    const ts = TVA.identifierTS(id)
    const date = new Date(ts)
    const timeZone = (id.startsWith('BBCNEWS') ? 'UTC' : 'America/Los_Angeles')
    return date.toLocaleString('en-US', { timeZone, weekday: 'short' })
  }


  static username() {
    TVA.render(`
<document>
  <formTemplate>
    <banner>
      <img src="https://archive.org/images/glogo.png" width="79" height="79"/>
      <description>
        Log in to Internet Archive account to see your Archive favorites
      </description>
    </banner>
    <textField>
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
  <formTemplate onselect="TVA.login()">
    <banner>
      <img src="https://archive.org/images/glogo.png" width="79" height="79"/>
      <description>
        Hello ${val}, enter your Internet Archive account password
      </description>
    </banner>
    <textField data-username="${val}">
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
    const user = e.getAttribute('data-username')
    const pass = e.getFeature('Keyboard').text

    TVA.alert(user)
    TVA.alert(pass)
  }


  static favorites() {
    TVA.alert('xxx')
  }


  static search() {
    TVA.alert('xxx')
  }


  /**
   * Like $.getJSON()
   * @param url string - REST API url that returns JSON
   * @param callback function - function to call with results (or error)
   */
  static fetchJSON(url, callback) {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'document'
    xhr.addEventListener('load', () => callback(xhr.responseText), false)
    // this.alert('FETCHING', url.replace(/&/g, '&amp;'))
    xhr.open('GET', url, true)
    xhr.send()
  }

  static fetchPOST(url, callback) {
    const xhr = new XMLHttpRequest()
    // Send the proper header information along with the request
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.responseType = 'document'
    xhr.addEventListener('load', () => callback(xhr.responseText), false)
    xhr.open('POST', url, true)
    xhr.send('foo=xxx&lorem=ipsum')
  }

  /**
   * convenience function inserts alert template, to present messages/errors to the user.
   */
  static alert(title, description) {
    TVA.render(`<?xml version="1.0" encoding="UTF-8"?>
  <document>
    <alertTemplate>
      <title>${title}</title>
      <description>${description}</description>
    </alertTemplate>
  </document>`)
  }

  /**
   * Renders markup to screen
   * @param ml string of TVML to render to screen
   */
  static render(ml) {
    const templateParser = new DOMParser()
    const parsedTemplate = templateParser.parseFromString(ml, 'application/xml')
    navigationDocument.pushDocument(parsedTemplate)
  }
}


// entry point from swift app
App.onLaunch = () => new TVA()
