/* the field to sort by */
const sortTypes = Object.freeze({
    SORT_NOSORT    : 0x0,
    SORT_DEFAULT   : 0x1,
    SORT_RANDOM    : 0x2,
    SORT_TOPIC     : 0x4,
    SORT_POINTS    : 0x8,
    QUERY_ANSWERED : 0x10,
    QUERY_ANSONLY  : 0x20
});
exports.sortTypes = sortTypes;

const userTypes = Object.freeze({
    ADMIN     : 0,
    STUDENT   : 1
});
exports.userTypes = userTypes;

const questionTypes = Object.freeze({
    REGULAR         : {name: 'Regular Question', value: 're', template: 'regex-answer'},
    MULTIPLECHOICE  : {name: 'Multiple Choice', value: 'mc', template: 'mc-answer'},
    TRUEFALSE  : {name: 'True and False', value: 'tf', template: 'tf-answer'}
});
exports.questionTypes = questionTypes;

const questionAttributes = Object.freeze({
    String 
});

 '[object Number]'
true
>'[object Number]'
true
'[object Number]'
false
'[object Object]'
true
'[object Array]'
