'use strict';

const {
  Table, 
  Button, 
  Suggestions, 
  Permission,
  Place } = require('actions-on-google');

const { sanitiseForSsml, insertSsmlBreak, fetchPrompt } = require('../helpers/utils.js');
const businessB = require('../helpers/businessBehaviours.js');
const callers = require('../helpers/callers.js');

/* Brendan London Tube expert - fulfillments */

let modulePackage = {};

const REPEAT_PREFIX = [
    'Sorry, I said ',
    'Let me repeat that. '
];

const HELP_PROMPTS = [
  'I can give you the tube status update, plan a journey or tell you which tube lines are present in London',
  'Hmm I can help you with your tube journey, inform you about the latest status update or tell you how many lines are present in the london underground network'
];

const WELCOME_PROMPTS = [
  'Hi There, I am Brendan the London tube expert'
];

const DEFAULT_FALLBACK = [
  'Sorry dear traveller, I didn\'t catch that',
  'Hmm, Sorry I didn\'t understand'
];

//proxy function that store the previous conversation 
function ask(conv, inputPrompt, noInputPrompt) {

  if(inputPrompt) {
    conv.data.lastPrompt = inputPrompt;
    conv.ask(inputPrompt);
  }

  if(noInputPrompt) {
    conv.data.noInputPrompt = noInputPrompt;
    conv.ask(noInputPrompt);
  }
}

//UC1 tube status update
modulePackage.statusUpdates = async function (conv) {

  try { 
    let [severity, lines] = await Promise.all([callers.getSeverity(), callers.getStatus()]);
    let updates = businessB.summarizedStatus(lines);
    let panel = businessB.generatedStatusPanel(lines);

    /* Build sentence for Brendan */

    conv.data.brendanSays
      .say('<p>There are');

    if(updates.size > 1){
      for(let [status, lines] of updates){
	lines = sanitiseForSsml(lines);
        conv.data.brendanSays
          .say(`<s>${status} on ${insertSsmlBreak(lines, 80)}</s>`)
          .break(500);
      }
    } else {
      let [uniqueStatus] = updates;
      conv.data.brendanSays
        .say(`<s>${uniqueStatus[0]} on all lines</s>`);
    }

    conv.data.brendanSays
      .break(500)
      .say('</p> I can help you to plan a journey or tell you the tube lines running in London.')
      .break(500)
      .say('What would you like to know?')

    //status update + suggestions
    ask(conv, conv.data.brendanSays.toString({ full:true, minimal: true }), panel);

  } catch(e) {
    console.log(e);

    conv.data.brendanSays
      .clear()
      .say('Sorry I cannot get the tube update at the moment.')
      .break(500)
      .say('I can give you the list of tube lines in London or plan a journey.')
      .break(500)
      .say('Which one of these do you want to be inform?');

    ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
  }
};


//UC2 journey
modulePackage.journey = (conv) => {
  ask(conv, new Permission({
    context: 'Current location',
    permissions: 'DEVICE_PRECISE_LOCATION',
    }));
}

modulePackage.get_location = (conv, params, permissionGranted) => {
  if(!permissionGranted){
    conv.data.brendanSays
      .say('Sorry I cannot without your permission')
      .break(500)
      .say('I can inform you about the tube status or tell you about the lines')
      .break(500)
      .say('Could you please tell me, what would you be interrested in?');

    ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}))
  } else {
    conv.user.storage.location = conv.device.location;
    ask(conv, '', new Place({
      prompt: 'What is your destination?',
      context: 'Get destination',
    }));
    ask(conv, '', new Suggestions(['London Bridge', 'St Paul\'s Cathedral', 'Leicester Square']));
  }
}

modulePackage.get_destination = async (conv, params, place, status) => {

  if(!place) {
    conv.data.brendanSays
      .say("Sorry, I couldn't find where you want to go")
      .break(500)
      .say('I could get for you the latest tube update and tell you more about tube lines in London.')
      .break(500)
      .say('Which one of these do you want to be inform?');

    ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
  } else {
    let {coordinates: endPoint} = place;
    let {coordinates: startPoint} = conv.user.storage.location;
    try {
      let {journeys} = await callers.getJourney(startPoint, endPoint); 
      let {legs: steps} = journeys[0];
      let instructions = steps.map(({instruction}) => instruction.summary);

      conv.data.brendanSays
	.say('<p>Ok, you have to ')

      instructions.forEach((inst, idx, arr) => {

	conv.data.brendanSays
	.say(`<s>${inst}</s>`)
	.break(500)

        //only add suffix during the conversation
        //except for the last sentence
        if(idx < arr.length - 1) {
          conv.data.brendanSays
            .say(' and ');
        } else {
          conv.data.brendanSays
            .say('</p>');
        }
      });
       
      conv.data.brendanSays
        .break(500)
        .say('Otherwise, I can give you the status update or tell you the tube lines are running in London.')
        .break(500)
        .say('What would you like to know?');

      // response plus suggestions
      ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
    } catch(e) {
      conv.data.brendanSays
	.clear()
	.say('<p><s>Sorry I did my best however I cannot get you the instructions to get there.</s>')
	.break(500)
	.say('<s>Meanwhile, I can give you the tube update or the list of tube lines in London</s>') //drive the conversation to available intents
        .say('<s>which one of these do you want to be inform?</s></p>')
      ask(conv, conv.data.brendanSays.toString({full: true, minimal: true})); 
    }
  }
}

//UCX provide tube lines list [small bonus]
modulePackage.lines = async (conv) => {

  try {
    let lines = await callers.getLines();
    let sanitisedLines = sanitiseForSsml(lines.map(({name}) => name));

    conv.data.brendanSays.say('<p><s>There are')
      .say({
        text: `${lines.length}`,
        interpretAs: 'cardinal'
      })
      .say(` tube lines in London which are ${insertSsmlBreak(sanitisedLines, 80)}</s>`)
      .break(500)
      .say('<s>Additionaly, I can give you the status update</s></p>')

    //conversation reply
    ask(conv, conv.data.brendanSays.toString({ full:true, minimal: true }));

    //visual reply
    ask(conv, '', new Table({
      title: 'Tube Lines',
      dividers: true,
      columns: ['line'],
      rows: lines.map(({name}) => [`${name}`])
    }));
  } catch(e) {

    console.log(e);

    conv.data.brendanSays
      .clear()
      .say('Sorry I cannot tell you that answer at the moment')
      .break(500)
      .say('I can you plan a journey or give you the tube update')
      .break(500)
      .say('Which one of these do you want to be inform?') //drive the conversation to available intents

    ask(conv, conv.data.brendanSays.toString({ full: true, minimal: true}));
  } 
};

//repeat intent
modulePackage.repeat = conv => {
  console.log(conv.data.lastPrompt);

  conv.data.brendanSays
    .say(fetchPrompt(REPEAT_PREFIX))
    .break(500)
    .say(conv.data.lastPrompt);

  ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
}

//help intent
modulePackage.help = conv => {

  conv.data.brendanSays
    .say(fetchPrompt(HELP_PROMPTS))
    .break(500)
    .say('What would you like to know?');

  ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
}

//welcome intent handler 
modulePackage.welcome = conv => {

  conv.data.brendanSays
    .say(fetchPrompt(WELCOME_PROMPTS)) //greating welcome message
    .break(500)
    .say(fetchPrompt(HELP_PROMPTS)) //drive the conversation to available intents
    .break(500)
    .say('What would you be interrested in ?') 

  ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
};

//default intent handler 
modulePackage.defaultFallback = conv => {

  conv.data.brendanSays
    .say(fetchPrompt(DEFAULT_FALLBACK)) //greating welcome message
    .break(500)
    .say(fetchPrompt(HELP_PROMPTS)) //drive the conversation to available intents
    .break(500)
    .say('What would you be interrested in ?') 

  ask(conv, conv.data.brendanSays.toString({full: true, minimal: true}));
};

module.exports = modulePackage;
