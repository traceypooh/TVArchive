
/**
  lint like:
  cd ~/dev/TVArchive  &&  /petabox/www/node_modules/.bin/eslint .
*/

/* global App navigationDocument */

let baseURL

/**
 * convenience function inserts alert template, to present messages/errors to the user.
 */
const createAlert = function (title, description) {
  const alertString = `
<?xml version="1.0" encoding="UTF-8"?>
<document>
  <alertTemplate>
    <title>${title}</title>
    <description>${description}</description>
  </alertTemplate>
</document>
`
  const parser = new DOMParser()
  const alertDoc = parser.parseFromString(alertString, 'application/xml')
  navigationDocument.pushDocument(alertDoc)
}


function parseJSON(information) {
  const result = JSON.parse(information)

  let vids = ''
  // eslint-disable-next-line  guard-for-in
  for (let network in result) {
    createAlert('parsing', network)
    const shows = result[network]

    // <title>${network}</title>
    vids += `
<shelf>
  <section>
`
    // eslint-disable-next-line  guard-for-in
    for (let show in shows) {
      vids += `
<lockup>
  <a href="https://archive.org/details/${show.identifier}">
    <img src="https://archive.org/services/img/${show.identifier}" width="360" height="248"/>
    <title>${show.title}</title>
  </a>
</lockup>`
    }

    vids += `
  </section>
</shelf>
`
  }

  const template = `
<document>
  <stackTemplate>
    <banner>
      <title>TV News Archive - Last Week</title>
    </banner>
    <collectionList>
      ${vids}
    </collectionList>
  </stackTemplate>
</document>`
  const templateParser = new DOMParser()
  const parsedTemplate = templateParser.parseFromString(template, 'application/xml')
  navigationDocument.pushDocument(parsedTemplate)
}


function getDocument(url) {
  const templateXHR = new XMLHttpRequest()
  templateXHR.responseType = 'document'
  templateXHR.addEventListener('load', function() { parseJSON(templateXHR.responseText) }, false)
  templateXHR.open('GET', url, true)
  templateXHR.send()
}


App.onLaunch = function (options) {
  createAlert('hmm', 'hai')
  baseURL = options.BASEURL
  const jsonURL = `${baseURL}lastweek.json`
  createAlert('loading', 'news from last week')
  // getDocument(jsonURL)
}
