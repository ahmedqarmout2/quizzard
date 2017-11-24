/*
The main server script

Copyright (C) 2016  Alexei Frolov, Larry Zhang
Developed at University of Toronto

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const db = require('./server/db.js');
const users = require('./server/users.js');
const questions = require('./server/questions.js');
const logger = require('./server/log.js');
const pug = require('pug');
const common = require('./server/common.js');
const analytics = require('./server/analytics.js');
const settings = require('./server/settings.js');
const json2csv = require('json2csv');
const fs = require('fs');
const csv2json = require('csvtojson');

const app = express();
const port = process.env.QUIZZARD_PORT || 8000;

/* Pre-compiled Pug views */
const studentTablePug = pug.compileFile('views/account-table.pug');
const accountCreationPug = pug.compileFile('views/account-creation.pug');
const accountEditPug = pug.compileFile('views/account-edit.pug');
const questionCreationPug = pug.compileFile('views/question-creation.pug');
const questionEditPug = pug.compileFile('views/question-edit.pug');
const questionTablePug = pug.compileFile('views/question-table.pug');
const questionListPug = pug.compileFile('views/questionlist.pug');
const statisticsPug = pug.compileFile('views/statistics.pug');
const regexFormPug = pug.compileFile('views/question_types/regex-answer.pug');
const mcFormPug = pug.compileFile('views/question_types/mc-answer.pug');
const tfFormPug = pug.compileFile('views/question_types/tf-answer.pug');
const chooseAllFormPug = pug.compileFile('views/question_types/chooseAll-answer.pug');
const matchingFormPug = pug.compileFile('views/question_types/matching-answer.pug');
const orderingFormPug = pug.compileFile('views/question_types/ordering-answer.pug');
const leaderboardTablePug = pug.compileFile('views/leaderboard-table.pug');
const discussionBoardPug = pug.compileFile('views/discussion.pug');
const settingsPug = pug.compileFile('views/settings.pug');

/* print urls of all incoming requests to stdout */
app.use(function(req, res, next) {
    logger.log(common.formatString('Request path: {0}', [req.url]));
    next();
});

app.set('view engine', 'pug');
app.use(fileUpload());
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'test',
    resave: true,
    saveUninitialized: false
}));

app.listen(port, function() {
    logger.log('//------------------------');
    logger.log(common.formatString('Server listening on http://localhost:{0}.', [port]));
    db.initialize(function() {});
});

/* main page */
app.get('/', function(req, res) {
    /* if the user has already logged in, redirect to home */
    if (req.session.user){
        return res.redirect('home');
    }

    return res.status(401).render('login');
});

/* check username and password and send appropriate response */
app.post('/login', function(req, res) {
    if ('user' in req.session) {
        req.session.destroy();
        return res.status(400).send('Invalid Request');
    }

    if (!req.body.user || !req.body.passwd) {
        return res.status(400).send('missing requirement');
    }

    var username = req.body.user.toLowerCase();
    var password = req.body.passwd;

    logger.log(common.formatString('Attempted login by user {0}', [username]));

    users.checkLogin(username, password, function(err, user) {
        if (err) {
            logger.error(common.formatString('User {0} failed logged in.', [username]));
            return res.status(403).send(err);
        }

        if (user) {
            logger.log(common.formatString('User {0} logged in.', [username]));
            req.session.user = user;

            if (user.type === common.userTypes.ADMIN) {
                return res.status(200).send('success');
            }

            if (user.type === common.userTypes.STUDENT) {
                settings.getClassActive(function (err, isActive) {
                    if (err) {
                        return res.status(500).send(err);
                    }

                    if (!isActive) {
                        return res.status(403).send('classNotActive');
                    }

                    return res.status(200).send('success');
                });
            }
        }
    });
});

/* End a user's session. */
app.get('/logout', function(req, res) {
    if (req.session.user) {
        logger.log(common.formatString('User {0} logged out.', [req.session.user._id]));
        req.session.destroy();
    }

    return res.redirect('/');
});

/* Display the home page. */
app.get('/home', function(req, res) {
    /* if the user has not yet logged in, redirect to login page */
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type === common.userTypes.ADMIN) {
        return res.redirect('/admin');
    }

    var request = { user : req.session.user, questionsStatus : 'unanswered' };
    users.getQuestionsListByUser(request, function(err, results) {
        if (err) {
            return res.status(500).send();
        }

        users.getStudentById(req.session.user._id, function(err, userFound) {
            if (err) {
                return res.status(500).send();
            }

            return res.status(200).render('home', {
                user: userFound,
                questions: results,
                getQuestionIcon: function(type) {
                    for (var i in common.questionTypes) {
                        if (type === common.questionTypes[i].value) {
                            return common.questionTypes[i].icon;
                        }
                    }
                    return 'help';
                }
            });
        });
    });
});

/* Display the leaderboard page. */
app.get('/leaderboard', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    return res.render('leaderboard', { user: req.session.user });
});

/* Display the admin page. */
app.get('/admin', function(req,res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (!req.session.user.type == common.userTypes.ADMIN) {
        return res.redirect('/home');
    }

    return res.render('admin', { user: req.session.user });
});

/* Display the about page. */
app.get('/about', function(req,res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    return res.render('about', { user: req.session.user });
});

/* Fetch and render the leaderboard table. Send HTML as response. */
app.get('/leaderboard-table', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var fullTable = true;
    var shortTable = false;

    if (req.query.fullTable === 'false') {
        fullTable = false;
    }

    if (req.query.longTable === 'false') {
        shortTable = true;
    }

    users.getLeaderboard(req.session.user._id, shortTable, function(leader) {
        var html = leaderboardTablePug({
            fullTable: fullTable,
            shortTable: shortTable,
            leaderboard: leader,
            userid: req.session.user._id
        });

        return res.status(200).send(html);
    });
});

/* Send the student table HTML. */
app.get('/studentlist', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (typeof req.query.active === 'undefined') {
        return res.status(500).send('Could not fetch student list');
    }

    /* only fetch student list once, then store it */
    users.getStudentsListWithStatus(req.query.active === 'true', function(err, studentlist) {
        if (err) {
            return res.status(500).send('Could not fetch student list');
        }

        var html = studentTablePug({
            students: studentlist
        });

        return res.status(200).send(html);
    });
});

/* Sort the list of student accounts by the specified criterion. */
app.post('/sortaccountlist', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (!req.session.adminStudentList) {
        var html = studentTablePug( { students : [] });

        return res.status(200).send(html);
    }

    students.sortAccounts(
        req.session.adminStudentList,
        req.body.type,
        req.body.asc == 'true',
        function (err, result) {
            if (err) {
                return res.status(500).send('Could not fetch student list');
            }

            var html = studentTablePug( { students : result } );

            return res.status(200).send(html);
        }
    );
});

/* Send the account creation form HTML. */
app.get('/accountform', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var html = accountCreationPug();

    return res.status(200).send(html);
});

/* Send the question creation form HTML. */
app.get('/questionform', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    settings.getAllSettings(function (err, allSettings) {
        if (err) {
            logger.error(err);
        }

        var html = questionCreationPug({
            questionType: common.questionTypes,
            defaultTopic: err ? null : allSettings.question.defaultTopic,
            defaultMinPoints: err ? 10 : allSettings.question.defaultMinPoints,
            defaultMaxPoints: err ? 100 : allSettings.question.defaultMaxPoints
        });

        return res.status(200).send(html);
    });
});

/* get question answer form */
app.get('/answerForm', function(req, res){
    switch (req.query.qType){
        case common.questionTypes.REGULAR.value:
            res.status(200).render(
                common.questionTypes.REGULAR.template,{answerForm:true});
            break;
        case common.questionTypes.MULTIPLECHOICE.value:
            res.status(200).render(
                common.questionTypes.MULTIPLECHOICE.template,{answerForm:true});
            break;
        case common.questionTypes.TRUEFALSE.value:
            res.status(200).render(
                common.questionTypes.TRUEFALSE.template,{answerForm:true});
            break;
        case common.questionTypes.CHOOSEALL.value:
            res.status(200).render(
                common.questionTypes.CHOOSEALL.template,{answerForm:true});
            break;
        case common.questionTypes.MATCHING.value:
            res.status(200).render(
                common.questionTypes.MATCHING.template,{answerForm:true});
            break;
        case common.questionTypes.ORDERING.value:
            res.status(200).render(
                common.questionTypes.ORDERING.template,{answerForm:true});
            break;
        default:
            return res.status(400).send('Please select an appropriate question Type.')
    }
})

/* Return a formatted date for the given timestamp. */
var creationDate = function(timestamp) {
    const months = ['Jan', 'Feb', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var date = new Date(timestamp);

    return months[date.getMonth() - 1] + ' ' + date.getDate() + ' ' + date.getFullYear();
}

/* Send the account editing form HTML. */
app.get('/accounteditform', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    users.getStudentById(req.query.userid, function(err, student){
        if (err || !student) {
            return res.status(500).send('Could not fetch user information');
        }

        var html = accountEditPug({
            user: student,
            cdate: student.ctime
        });

        return res.status(200).send(html);
    });
});

/* Send the question table HTML. */
app.get('/questionlist', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var userId = req.session.user._id;
    users.getUserById(userId, function(err, user){
        if (err || !user) {
            return res.status(400).send('bad request, user does not exist');
        }

        var request = {};
        request.questionsStatus = req.query.type;
        request.user = user;
        users.getQuestionsListByUser(request, function(err, questionsList){
            if (err) {
                return res.status(500).send('Could not fetch questions list');
            }

            var html = null;
            if (req.session.user.type === common.userTypes.ADMIN) {
                html = questionTablePug({
                    questions : questionsList,
                    questionType: function(type){
                        for (var i in common.questionTypes) {
                            if (type === common.questionTypes[i].value) {
                                return common.questionTypes[i].name;
                            }
                        }
                        return 'UNKNOWN';
                    }
                 });
            }

            if (req.session.user.type === common.userTypes.STUDENT) {
                html = questionListPug({
                    questions : questionsList,
                    getQuestionIcon: function(type) {
                        for (var i in common.questionTypes) {
                            if (type === common.questionTypes[i].value) {
                                return common.questionTypes[i].icon;
                            }
                        }
                        return 'help';
                    }
                 });
            }

            return res.status(200).send(html);
        });
    });
});

/* Send the question editing form HTML. */
app.get('/questionedit', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var qId = req.query.questionid;
    questions.lookupQuestionById(qId, function(err, question){
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        if (!question) {
            return res.status(400).send('Question not found');
        }

        var html = questionEditPug({
            question: question,
            getQuestionForm: function(){
                switch (question.type){
                    case common.questionTypes.REGULAR.value:
                        return regexFormPug({adminQuestionEdit:true, question:question})
                    case common.questionTypes.MULTIPLECHOICE.value:
                        return mcFormPug({adminQuestionEdit:true, question:question})
                    case common.questionTypes.TRUEFALSE.value:
                        return tfFormPug({adminQuestionEdit:true, question:question})
                    case common.questionTypes.CHOOSEALL.value:
                        return chooseAllFormPug({adminQuestionEdit:true, question:question})
                    case common.questionTypes.MATCHING.value:
                        return matchingFormPug({adminQuestionEdit:true, question:question})
                    case common.questionTypes.ORDERING.value:
                        return orderingFormPug({adminQuestionEdit:true, question:question})
                    default:
                        return res.redirect('/')
                        break;
                }
            }
        });

        var userRating = 0;
        for (var i in question.ratings) {
            if (req.session.user._id === question.ratings[i].userId) {
                userRating = question.ratings[i].rating;
            }
        }

        return res.status(200).send({
            html: html,
            qtext: question.text,
            qrating: userRating
        });
    });
});

/* Send the application statistics HTML. */
app.get('/statistics', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        res.status(403).send('Permission Denied');
    }

    questions.getAllQuestionsList(function(err, questionslist) {
        if (err) {
            res.status(500).send(err);
        }

        users.getStudentsList(function(err, studentslist) {
            if (err) {
                res.status(500).send(err);
            }

            var html = statisticsPug({
                students: studentslist,
                questions: questionslist
            });

            return res.status(200).send(html);
        });
    });
});

/* Display the question page. */
app.get('/question', function(req, res) {
    /* if the user has not yet logged in, redirect to login page */
    if (!req.session.user) {
        return res.redirect('/');
    }

    questions.lookupQuestionById(req.query._id, function(err, questionFound) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        if (!questionFound) {
            return res.status(404).render('page-not-found');
        }

        if (!questionFound.visible && req.session.user.type === common.userTypes.STUDENT) {
            return res.status(400).send('Question is not available');
        }

        var answeredList = common.getIdsListFromJSONList(questionFound.correctAttempts, 'userId');
        var hasQrating = false;
        for (var i in questionFound.ratings) {
            if (questionFound.ratings[i].userId === req.session.user._id) {
                hasQrating = true;
            }
        }
        return res.status(200).render('question-view', {
            user: req.session.user,
            question: questionFound,
            answered: (answeredList.indexOf(req.session.user._id) !== -1),
            isAdmin : function() {
                return req.session.user.type === common.userTypes.ADMIN;
            },
            hasQrating: hasQrating,
            getQuestionForm: function(){
                switch (questionFound.type){
                    case common.questionTypes.REGULAR.value:
                        return regexFormPug({studentQuestionForm:true})
                    case common.questionTypes.MULTIPLECHOICE.value:
                        return mcFormPug({studentQuestionForm:true, question:questionFound})
                    case common.questionTypes.TRUEFALSE.value:
                        return tfFormPug({studentQuestionForm:true, question:questionFound})
                    case common.questionTypes.CHOOSEALL.value:
                        return chooseAllFormPug({studentQuestionForm:true, question:questionFound})
                    case common.questionTypes.MATCHING.value:
                        // randomize the order of the matching
                        questionFound.leftSide = common.randomizeList(questionFound.leftSide);
                        questionFound.rightSide = common.randomizeList(questionFound.rightSide);
                        return matchingFormPug({studentQuestionForm:true, question:questionFound})
                    case common.questionTypes.ORDERING.value:
                        // randomize the order of ordering question
                        questionFound.answer = common.randomizeList(questionFound.answer);
                        return orderingFormPug({studentQuestionForm:true, question:questionFound})
                    default:
                        break;
                }
            }
        });
    });
});

/* check if the submitted answer is correct */
app.post('/submitanswer', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var questionId = req.body.questionId;
    var answer = req.body.answer;
    var userId = req.session.user._id;

    questions.lookupQuestionById(questionId,function(err, question){
        if(err){
            logger.error(err);
            return res.status(500).send(err);
        }

        if(!question){
            logger.log(common.formatString('Could not find the question {0}', [questionId]));
            return res.status(400).send('Could not find the question');
        }

        logger.log(common.formatString('User {0} attempted to answer question {1} with "{2}"', [userId, questionId, answer]));

        var value = questions.verifyAnswer(question, answer);
        var points = Math.floor(Math.max(question.minpoints, question.maxpoints/Math.cbrt(question.correctAttemptsCount + 1)));
        var text = value ? 'correct' : 'incorrect';
        var status = value ? 200 : 500;
        var response = {text: text, points: points};

        if (req.session.user.type === common.userTypes.ADMIN) {
            return res.status(status).send(response);
        }

        users.submitAnswer(userId, questionId, value, points, answer, function(err, result){
            if(err){
                logger.error(err);
                return res.status(500).send(err);
            }

            questions.submitAnswer(questionId, userId, value, points, answer, function(err, result) {
                if(err){
                    logger.error(err);
                    return res.status(500).send(err);
                }

                return res.status(status).send(response);
            });
        });
    });
});

/*
 * Create a new user.
 * The request body contains an incomplete student object with attributes
 * from the fields in the user creation form.
 * If the user ID already exists, creation fails.
 * Otherwise, the user is inserted into the database and added
 * to the active admin student list.
 */
app.put('/useradd', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    users.addStudent(req.body, function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        return res.status(201).send('User created');
    });
});

/*
 * Delete a user with from the database.
 * The request body is an object with a single 'userid' field,
 * containing the ID of the user to be deleted.
 */
app.post('/setUserStatus', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    users.setUserStatus(req.body.userid, req.body.active === 'true' , function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send('Failed to deactivate student account');
        }

        return res.status(200).send('Student account has been deactivcated');
    });
});

/*
 * update the profile of a user given the information
 */
app.post('/profilemod', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.body.newpassword !== req.body.confirmpassword) {
        logger.log('Confirm password doesn\'t match');
        return res.status(400).send('Confirm password doesn\'t match');
    }

    var userId = req.session.user._id;
    users.getUserById(userId, function (err, userObj) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        if (!userObj) {
            return res.status(400).send('User can not be found');
        }

        users.checkLogin(userId, req.body.currentpasswd, function(err, user) {
            if (err || !user) {
                logger.error(common.formatString('User {0} failed to authenticate.', [userId]));
                return res.status(403).send(err);
            }

            if (user) {
                users.updateProfile(userId, req.body, function (err, result) {
                    if (err) {
                        return res.status(500).send(err);
                    }

                    return res.status(200).send('ok');
                });
            }
        });
    });
});

/*
 * Modify a user object in the database.
 * The request body contains a user object with the fields to be modified.
 */
app.post('/usermod', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    var userId = req.body._id;
    users.updateStudentById(userId, req.body, function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send();
        }

        users.getStudentById(userId, function(err, userFound) {
            if (err || !userFound) {
                logger.error(err);
                return res.status(500).send();
            }

            var html = accountEditPug({
                user: userFound,
                cdate: creationDate(userFound.ctime)
            });

            return res.status(200).send({
                result: result,
                html: html
            });
        });
    });
});

/*
 * Add a question to the database.
 * The request body contains the question to be added.
 */
app.put('/questionadd', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    questions.addQuestion(req.body, function(err, qId) {
        if (err) {
            logger.error(err);
            return res.status(err.status).send(err.msg);
        }

        if (req.body.rating && parseInt(req.body.rating) > 0 && parseInt(req.body.rating) < 6) {
            req.body.qId = qId;
            return submitQuestionRating(req, res);
        }

        return res.status(201).send('Question created');
    });
});

/*
 * Modify a question in the database.
 * Request body contains question's ID and a question object with
 * the fields to be changed.
 */
app.post('/questionmod', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var qid = req.body.id;
    var q = req.body.question;

    questions.updateQuestionById(qid, q, function(err, result) {
        if (err){
            logger.error(err);
            return res.status(err.status).send(err.msg);
        }
        return res.status(200).send(result);
    });
});

/*
 * Remove a question from the database.
 * The request body contains the ID of the question to delete.
 */
app.post('/questiondel', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    return res.status(200);
});

// submit question rating from both students and admins
app.post('/submitQuestionRating', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }
    return submitQuestionRating(req, res);
});

// question rating from both students and admins
var submitQuestionRating = function (req, res) {
    var userId = req.session.user._id;
    var questionId = req.body.qId;
    var rating = parseInt(req.body.rating);

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).send('bad rating');
    }

    questions.submitRating(questionId, userId, rating, function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send('could not submit rating');
        }

        users.submitRating(userId, questionId, rating, function(err, result) {
            if (err) {
                logger.error(err);
                return res.status(500).send('could not submit rating');
            }

            return res.status(200).send('rating submitted');
        });
    });
}

// get discussion board
app.get('/getDiscussionBoard', function(req, res){
    if (!req.session.user) {
        return res.redirect('/');
    }

    settings.getDiscussionboardVisibilityEnabled(function (err, boardVisibility) {
        if (err) {
            return res.status(500).send(err);
        }

        if (boardVisibility === common.discussionboardVisibility.NONE
            && req.session.user.type === common.userTypes.STUDENT) {
            return res.status(500).send('hidden');
        }

        settings.getDiscussionboardDislikesEnabled(function (err, isDislikesEnabled) {
            if (err) {
                isDislikesEnabled = false;
            }

            var questionId = req.query.questionId;
            questions.lookupQuestionById(questionId, function (err, question) {
                if (err) {
                    logger.error(err);
                    return res.status(500).send(err);
                }

                if (!question) {
                    logger.error(common.formatString('Could not find the question {0}', [questionId]));
                    return res.status(400).send('Could not find the question');
                }

                if (boardVisibility === common.discussionboardVisibility.ANSWERED) {
                    var answeredList = common.getIdsListFromJSONList(question.correctAttempts, 'userId');
                    var answered = (answeredList.indexOf(req.session.user._id) !== -1);

                    if (req.session.user.type === common.userTypes.STUDENT && !answered) {
                        return res.status(500).send('hidden');
                    }
                }

                users.getUsersList((err, userObj) => {
                    if (err) {
                        return res.status(500).send('Could not get the list of students');
                    }

                    var usersList = {};
                    for (var i in userObj) {
                        var user = userObj[i];
                        usersList[user._id] = user.fname + ' ' + user.lname;
                    }

                    var discussionHtml = discussionBoardPug({
                        comments: question.comments,
                        isDislikesEnabled: isDislikesEnabled,
                        getCurrentUser: () =>{
                            var userId = req.session.user._id;
                            if (!usersList[userId]) {
                                return 'UNKNOWN';
                            }
                            return usersList[userId];
                        },
                        getFirstLastName: (userId) => {
                            if (!usersList[userId]) {
                                return 'UNKNOWN';
                            }
                            return usersList[userId];
                        },
                        isLiked: (likesList) => {
                            return likesList.indexOf(req.session.user._id) !== -1;
                        },
                        isDisliked: (dislikesList) => {
                            return dislikesList.indexOf(req.session.user._id) !== -1;
                        },
                        highlightMentionedUser: (comment) => {
                            var userId = req.session.user._id;
                            if (!usersList[userId]) {
                                return '@UNKNOWN';
                            }

                            var fullName = '@' + usersList[userId];
                            var newComment = '';
                            if (comment.indexOf(fullName) > -1) {
                                var parts = comment.split(fullName);
                                for (var i = 0; i < parts.length-1; i++) {
                                    newComment += parts[i] + '<b>' + fullName + '</b>';
                                }
                                newComment += parts[parts.length-1];
                            } else {
                                newComment = comment;
                            }
                            return newComment;
                        }
                    });

                    return res.status(200).send(discussionHtml);
                });
            });
        });
    });
});

// add comments to a question
app.post('/addCommentToQuestion', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var questionId = req.body.questionId;
    var comment = req.body.commentText;
    var userId = req.session.user._id;

    questions.addComment(questionId, userId, comment, function (err, question) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        return res.status(200).send('Ok');
    });
});

// add reply to a comment
app.post('/addReplyToComment', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var commentId = req.body.commentId;
    var reply = req.body.replyText;
    var userId = req.session.user._id;

    questions.addReply(commentId, userId, reply, function (err, question) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        return res.status(200).send('Ok');
    });
});

// vote on a comment
app.post('/voteOnComment', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var commentId = req.body.commentId;
    var vote = parseInt(req.body.vote);
    var userId = req.session.user._id;

    if (!vote || (vote !== 1 && vote !== -1)) {
        return res.status(400).send('Vote is invalid');
    }

    logger.log(common.formatString('{0} {1} {2}', [commentId, vote, userId]));

    questions.voteComment(commentId, vote, userId, function (err, value) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        return res.status(200).send(value);
    });
});

// vote on a reply
app.post('/voteOnReply', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var replyId = req.body.replyId;
    var vote = parseInt(req.body.vote);
    var userId = req.session.user._id;

    if (!vote || (vote !== 1 && vote !== -1)) {
        return res.status(400).send('Vote is invalid');
    }

    logger.log(common.formatString('{0} {1} {2}', [replyId, vote, userId]));

    questions.voteReply(replyId, vote, userId, function (err, value) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        return res.status(200).send(value);
    });
});

// gets the users that have answered the question
app.get('/usersToMentionInDiscussion', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    var questionId = req.query.questionId;
    questions.lookupQuestionById(questionId, function (err, question){
        if (err) {
            logger.error(err);
            return res.status(500).send('could not find the question');
        }

        if (!question) {
            return res.status(400).send('Invalid questionId');
        }

        users.getUsersList(function (err, usersList) {
            if (err) {
                logger.error(err);
                return res.status(500).send('could not find the list of users');
            }

            settings.getAllSettings(function (err, allSettings) {
                if (err) {
                    return res.status(500).send('Could not fetch the settings');
                }

                var totalList = [];

                if (allSettings.discussionboard.visibility === common.discussionboardVisibility.ALL) {
                    for (var i in usersList) {
                        var user = usersList[i];
                        if (req.session.user._id !== user._id) {
                            totalList.push(user.fname+' '+user.lname);
                        }
                    }
                } else if (allSettings.discussionboard.visibility === common.discussionboardVisibility.ANSWERED) {
                    var answeredList = [];
                    for (var i in question.correctAttempts) {
                        answeredList.push(question.correctAttempts[i].userId);
                    }

                    for (var i in usersList) {
                        var user = usersList[i];
                        if (req.session.user._id !== user._id &&
                            (user.type === common.userTypes.ADMIN || answeredList.indexOf(user._id) !== -1)) {
                              totalList.push(user.fname+' '+user.lname);
                        }
                    }
                }

                return res.status(200).send(totalList);
            });
        });
    });
});

// questions list of topics
app.get('/questionsListofTopics', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    questions.getAllQuestionsList(function(err, docs) {
        if (err) {
            logger.error(err);
            return res.status(500).send('could not get the list of questions topics');
        }

        var topicsList = [];
        for (var i in docs) {
            if (topicsList.indexOf(docs[i].topic) === -1) {
                topicsList.push(docs[i].topic);
            }
        }

        return res.status(200).send(topicsList);
    });
});

/* get the list of students' ids*/
app.get('/studentsListofIdsNames', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    users.getStudentsList(function(err, studentList) {
        if (err) {
            logger.error(err);
            return res.status(500).send('Could not fetch student list');
        }

        var idsList = [];
        for (s in studentList) {
            idsList.push(studentList[s].username + ' - ' + studentList[s].fname + ' ' + studentList[s].lname);
        }
        return res.status(200).send(idsList);
    });
});

/* Display accounts export form */
app.get('/accountsExportForm', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    users.getStudentsList(function(err, studentsList) {
        if (err) {
            logger.error(err);
            return res.status(500).send('Failed to get students list');
        }

        return res.status(200).render('users/accounts-export-form', {
            user: req.session.user,
            students: studentsList
        });
    });
});

/* Display accounts import form */
app.get('/accountsImportForm', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    return res.status(200).render('users/accounts-import-form', {
        user: req.session.user
    });
});

/* Display accounts export form */
app.post('/accountsExportFile', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    if (!common.dirExists(common.fsTree.USERS, req.session.user._id)) {
        logger.error(common.formatString('User {0} does not exists in the file system', [req.session.user._id]));
        return res.status(500).send('User does not exists in the file system');
    }

    var requestedList = req.body.studentsList;
    var totalCount = requestedList.length;
    var studentsCount = 0;
    var studentsList = [];
    var errors = 0;

    for (var i in requestedList) {
        users.getStudentById(requestedList[i], function(err, studentFound) {
            if (err || !studentFound) {
                logger.error('Could not find a student from the export list');
                errors++;
            }

            studentsList.push(studentFound);
            studentsCount++;
            if (studentsCount === totalCount) {
                if (errors > 0) {
                    return res.status(500).send('Could not find a student from the export list');
                }

                var fields = ['username', 'fname', 'lname', 'email'];
                var fieldNames = ['Username', 'First Name', 'Last Name', 'Email'];
                var csvData = json2csv({ data: studentsList, fields: fields, fieldNames: fieldNames });
                var file = 'exportJob-students-'+new Date().toString();
                var fileName = file + '.csv';

                var userDirectory = common.joinPath(common.fsTree.USERS, req.session.user._id);
                common.saveFile(userDirectory, file, 'csv', csvData, function(err, result) {
                    if (err) {
                        logger.error(err);
                        return res.status(500).send('Export job failed');
                    }
                    return res.status(200).render('users/accounts-export-complete', {
                        file: fileName
                    });
                });
            }
        });
    }
});

// import the students' list file
app.post('/accountsImportFile', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    if (!common.dirExists(common.fsTree.USERS, req.session.user._id)) {
        logger.error(common.formatString('User {0} does not exists in the file system', [req.session.user._id]));
        return res.status(500).send('User does not exists in the file system');
    }

    var uploadedFile = req.files.usercsv;
    if (!uploadedFile || uploadedFile.mimetype !== 'text/csv') {
        return res.status(400).send('Invalid file format');
    }

    var newFileName = 'importJob-students-' + uploadedFile.name;
    var newFile = common.joinPath(common.fsTree.USERS, req.session.user._id, newFileName);
    uploadedFile.mv(newFile, function(err) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        logger.log(common.formatString('Uploaded: {0}', [newFile]));

        var importedList = [];
        csv2json().fromFile(newFile).on('json', function(jsonObj) {
            var userObj = {};
            userObj['username'] = jsonObj['Username'];
            userObj['fname'] = jsonObj['First Name'];
            userObj['lname'] = jsonObj['Last Name'];
            userObj['email'] = jsonObj['Email'];
            importedList.push(userObj);
        }).on('done', function(err) {
            if (err) {
                return res.status(500).send('Failed to parse the csv file');
            }

            return res.status(200).render('users/accounts-import-list', {
                students: importedList
            });
        });
    });
});

// import the students' list file
app.post('/accountsImportList', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    if (!req.body.selectedList) {
        return res.status(400).send('Invalid students\' list');
    }

    var inputLen = req.body.selectedList.length;
    var inputList = req.body.selectedList;
    var added = 0;
    var failed = 0;
    var exist = 0;
    var total = 0;

    if (inputLen === 0) {
        return res.status(200).send('ok');
    }

    for (var i in inputList) {
        var inputUser = inputList[i];
        var userToAdd = {
            fname: inputUser.fname,
            lname: inputUser.lname,
            username: inputUser.username,
            email: inputUser.email,
            password: 'KonniChiwa'
        };
        users.addStudent(userToAdd, function (err, userObj) {
            total++;

            if (err) {
                if (err === 'exists') {
                    exist++;
                } else {
                    failed++;
                }
            } else {
                added++;
            }

            if (total === inputLen) {
                return res.status(200).render('users/accounts-import-complete',{
                    added: added,
                    failed: failed,
                    exist: exist,
                    total: total
                });
            }
        });
    }
});

/* download */
app.get('/download', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (!common.dirExists(common.fsTree.USERS, req.session.user._id)) {
        logger.error(common.formatString('User {0} does not exists in the file system', [req.session.user._id]));
        return res.status(500).send('User does not exists in the file system');
    }

    var fileName = req.query.file;
    var userDir = common.joinPath(common.fsTree.USERS, req.session.user._id);
    if (!common.fileExists(userDir, fileName)) {
        logger.error(common.formatString('File: {0} does not exist', [fileName]));
        return res.status(500).send('File does not exist');
    }

    var filePath = common.joinPath(common.fsTree.USERS, req.session.user._id, fileName);
    return res.download(filePath, fileName, function (err) {
        if (err) {
            logger.error(err);
        }
    });
});

/* Display some charts and graphs */
app.get('/analytics', function(req, res){
    if (!req.session.user) {
        return res.redirect('/');
    }

    return res.status(200).render('analytics', {
        user: req.session.user,
        isAdmin : function() {
            return req.session.user.type === common.userTypes.ADMIN;
        }
    });
});

/* Get the profile page */
app.get('/profile', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    settings.getAllSettings(function (err, allSettings) {
        if (err) {
            logger.error(err);
            return res.status(500).send(err);
        }

        users.getUserById(req.session.user._id, function(err, user) {
            if (err) {
                logger.error(err);
                return res.status(500).send(err);
            }

            if (!user) {
                return res.status(400).send('bad request, user does not exist');
            }

            if (user.type === common.userTypes.ADMIN) {
                allSettings.student.editNames = true;
                allSettings.student.editEmail = true;
                allSettings.student.editPassword = true;
            }

            return res.status(200).render('profile', {
                user: user,
                editNamesEnabled: allSettings.student.editNames,
                editEmailEnabled: allSettings.student.editEmail,
                editPasswordEnabled: allSettings.student.editPassword
            });
        });
    });
});

/* Get the settings page */
app.get('/settings', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    settings.getAllSettings(function (err, allSettings) {
        if (err) {
            return res.status(500).send('Could not fetch the settings');
        }

        var html = settingsPug({
            generalActive: allSettings.general.active,
            generalLeaderboardLimit: allSettings.general.leaderboardLimit,
            studentEditNames: allSettings.student.editNames,
            studentEditEmail: allSettings.student.editEmail,
            studentEditPassword: allSettings.student.editPassword,
            questionDefaultTopic: allSettings.question.defaultTopic,
            questionDefaultMinPoints: allSettings.question.defaultMinPoints,
            questionDefaultMaxPoints: allSettings.question.defaultMaxPoints,
            questionTimeoutEnabled: allSettings.question.timeoutEnabled,
            questionTimeoutPeriod: allSettings.question.timeoutPeriod,
            discussionboardVisibility: allSettings.discussionboard.visibility,
            discussionboardDislikesEnabled: allSettings.discussionboard.dislikesEnabled,
            checkDiscussionboardVisibility: function (radioButtonValue) {
                return allSettings.discussionboard.visibility === radioButtonValue;
            }
        });
        return res.status(200).send(html);
    });
});

/* Reset the website settings to the default values */
app.post('/resetSettings', function (req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    settings.resetAllSettings(function (err, result) {
        return res.status(err ? 500 : 200).send(err ? err : 'ok');
    });
});

/* Update the settings collection */
app.post('/updateSettings', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    settings.updateSettings(req.body.settings, function (err, result) {
        if (err) {
            return res.status(500).send('Could not update the settings');
        }

        return res.status(200).send('ok');
    });
});

/* get analytics for a student*/
app.get('/studentAnalytics', function(req,res){
    if (!req.session.user) {
        return res.redirect('/');
    }

    var query = {userId: req.session.user._id, type: req.query.type};

    if (req.session.user.type === common.userTypes.ADMIN) {
        if (!req.query.studentId) {
            return res.status(500).send('no student graphs for admins');
        }
        query.userId = req.query.studentId;
    }

    analytics.getChart(query, function(err, result){
        return res.status(200).send(result);
    });
});

/* get analytics for a admins*/
app.get('/adminAnalytics', function(req,res){
    if (!req.session.user) {
        return res.redirect('/');
    }

    if (req.session.user.type !== common.userTypes.ADMIN) {
        return res.status(403).send('Permission Denied');
    }

    var query = {user: req.session.user, type: req.query.type};

    analytics.getChart(query, function(err, result){
        return res.status(200).send(result);
    });
});

// 404 route
app.use(function(req, res, next){
    return res.status(404).render('page-not-found');
});
