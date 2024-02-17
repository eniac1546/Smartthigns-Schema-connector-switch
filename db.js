'use strict'
const fs = require('fs')

const filename = './data.json'
const initialStates = {
	'external-device-1': {
		main: {
			switch: 'off'
		}
	}
}

let deviceStates = {}

module.exports = {
	getState(externalId) {
		return deviceStates[externalId]
	},

	getAttribute(externalId, component, attribute) {
		return deviceStates[externalId][component][attribute]
	},

	setAttribute(externalId, component, attribute, data) {
		deviceStates[externalId][component][attribute] = data
		saveStates()
	},
}

function readStates() {
	if (fs.existsSync(filename)) {
		const savedStates = JSON.parse(fs.readFileSync(filename, 'UTF-8'))
		deviceStates = {...initialStates, ...savedStates}
	} else {
		deviceStates = initialStates
	}
}

function saveStates() {
	fs.writeFileSync(filename, JSON.stringify(deviceStates, null, 2), 'UTF-8')
}

readStates()
