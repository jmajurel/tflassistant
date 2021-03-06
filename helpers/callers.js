'use strict';

const rp = require('request-promise-native');
/* API calls */

const rpOptionTFL = {
  baseUrl: 'https://api.tfl.gov.uk/',
  qs: {
    app_id: process.env.TFLAppId,
    app_key: process.env.TFLAppKey
  },
  json: true
};

const rpOptionGEO = {
  method:'POST',
  uri:'https://www.googleapis.com/geolocation/v1/geolocate',
  qs: {
    key: process.env.GeoAPIKey
  },
  json: true
};

let modulePackage = {};
const transportMode = 'tube';

modulePackage.getSeverity = function(){
  rpOptionTFL.uri = '/Line/Meta/Severity';
  return rp(rpOptionTFL)
}

modulePackage.getStatus = function(){
  rpOptionTFL.uri = `/Line/Mode/${transportMode}/Status`; 
  return rp(rpOptionTFL);
}

modulePackage.getLines = function(){
  rpOptionTFL.uri = `/Line/Mode/${transportMode}`;
  return rp(rpOptionTFL);
}

modulePackage.getFutureStatusForOneLine = function(line, startDate, endDate){
  rpOptionTFL.uri = `/Line/${line}/Status/${startDate}/to/${endDate}`;
  return rp(rpOptionTFL);
}

modulePackage.getCurrLocation = function() {
  return rp(rpOptionGEO);
}

modulePackage.getJourney = function(startLoc, endLoc){
  console.log(startLoc);
  console.log(endLoc);
  rpOptionTFL.uri = `/journey/journeyresults/${startLoc.latitude},${startLoc.longitude}/to/${endLoc.latitude},${endLoc.longitude}`;
  return rp(rpOptionTFL);
}

module.exports = modulePackage;
