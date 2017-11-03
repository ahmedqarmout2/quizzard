var questionId = window.location.href.split('?_id=')[1];

$('#re_answerform').submit(function(evt) {
    evt.preventDefault();
    var ans = $('#answer').val();
    sendAnswerRequest(ans);
});

$('#mc_answerform').submit(function(evt) {
    evt.preventDefault();
    var ans = $("input[name=answer]:checked").val();
    sendAnswerRequest(ans);
});
$('#tf_answerform').submit(function(evt) {
    evt.preventDefault();
    var ans = $("input[name=tfbutton]:checked").val();
    sendAnswerRequest(ans);
});

$('#match_answerform').submit(function(evt) {
    evt.preventDefault();
    var leftAnswers = [];
    var rightAnswers = [];

    for (i=0; i<answerList.length; i++) {
      leftAnswers.push($('#ansLeft' + answerList[i]).text());
      rightAnswers.push($('#ansRight' + answerList[i]).text());
    }

    sendAnswerRequest([leftAnswers,rightAnswers]);
});

var sendAnswerRequest = function(ans) {
    $.ajax({
        type: 'POST',
        url: '/submitanswer',
        data: { questionId: questionId, answer: ans },
        success: function(data) {

            $('#modalAlert').modal({
                dismissible: false,
                opacity: 0.5,
                complete: function() {
                    if(getRating() > 0) {
                        submitQuestionRating(getRating(), questionId);
                    }                    
                    window.location.href = '/';
                }
            });

            $('#modalAlertMsg').html('Congratulations! You gained ' + data.points + ' points!<br><br><br>Please rate the difficulty of this question:');

            $('#modalAlert').modal('open');

            /* swal({
                html:true,
                title: 'Correct',
                text: 'Congratulations! You gained ' + data.points + ' points!<br><br>Please rate the difficulty of this question:<br><div class="rating"><i class="medium material-icons" id="0" onmouseover="highlight(0)" onmouseout="highlight(rating)" onclick="setRating(1)">star_border</i><i class="medium material-icons" id="1" onmouseover="highlight(1)" onmouseout="highlight(rating)" onclick="setRating(2)">star_border</i><i class="medium material-icons" id="2" onmouseover="highlight(2)" onmouseout="highlight(rating)" onclick="setRating(3)">star_border</i><i class="medium material-icons" id="3" onmouseover="highlight(3)" onmouseout="highlight(rating)" onclick="setRating(4)">star_border</i><i class="medium material-icons" id="4" onmouseover="highlight(4)" onmouseout="highlight(rating)" onclick="setRating(5)">star_border</i></div>',
                type: 'success'
            }, function (isConfirm) {
                if(isConfirm) {
                    
                }
                window.location.href = '/';
            }); */
        },
        error: function(data) {
            $('#hint').removeClass('hidden');
            swal('Incorrect', 'Sorry, that\'s the wrong answer', 'error');
        },
        complete: function(data) {
            const numberOfAttempts = $('#attempts');
            numberOfAttempts.html(parseInt(numberOfAttempts.html()) + 1);
        }
    });
}