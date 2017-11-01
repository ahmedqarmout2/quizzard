var students;
var studentList;

$(function() {
  $('#nav-analytics').addClass('active');

  // Loads the Student statistics by default
  displayStudentStatistics(null);

  // Loads the list of students so that the instructor can select one
  getStudentList();
  studentList = {};
  for (var s in students) {
    studentList[students[s]] = null;
  }

  // Setting up the autocomplete search for the student IDs
  $('#autocomplete-input').autocomplete({
    data: studentList,
    limit: 20,
    onAutocomplete: function(val) {
      $('#student-analytics-card-content').removeClass('hidden');
      displayStudentStatistics(val);
    },
    minLength: 1,
  });

  // Showing the analytics automatically
  $('#autocomplete-input').keyup(function() {
    const autocompleteValue = $('#autocomplete-input').val();

    for (var s in studentList) {
      if (s === autocompleteValue) {
        $('#student-analytics-card-content').removeClass('hidden');
        displayStudentStatistics(autocompleteValue);
        return;
      }
    }

    $('#student-analytics-card-content').addClass('hidden');
  });
});

/**
* Gets the list of student IDs
*/
var getStudentList = function() {
  $.ajax({
    type: 'GET',
    async: false,
    url: '/studentsListofIds',
    success: function(data) {
      students = data;
    },
    error: function(data){
      students = ['Error'];
    }
  });
}

/**
* Switching to class statistics tab
*/
$('#option-class').click(function(evt) {
    displayClassStatistics();
});

/**
* Switching to student statistics tab
*/
$('#option-student').click(function(evt) {
    displayStudentStatistics(null);
});

/**
* Class statistics
* Sets up the card visibility
* Calls requested charts to update
*/
var displayClassStatistics = function() {
    // Card visibilty
    $('#student-analytics-card').addClass('hidden');
    $('#studentSelector').addClass('hidden');
    $('#class-analytics-card').removeClass('hidden');

    $('#studentAnalyticsHeader').addClass('hidden');
    $('#classAnalyticsHeader').addClass('hidden');
}

/**
* Student statistics
* Sets up the card visibility
* Calls requested charts to update
*/
var displayStudentStatistics = function(studentId) {
    // Card visibilty
    $('#student-analytics-card').removeClass('hidden');
    $('#studentSelector').removeClass('hidden');
    $('#class-analytics-card').addClass('hidden');

    $('#studentAnalyticsHeader').removeClass('hidden');
    $('#classAnalyticsHeader').removeClass('hidden');

    var path = studentId ? '/studentAnalytics?studentId=' + studentId : '/studentAnalytics';

    // Request statistics

    // Student and Class Statistics
    getQuestionsAnsweredStudentAndClass(path);
    getAccuracyStudentAndClass(path);
    getPointsStudentAndClass(path);
    getRatingStudentAndClass(path);
}

var getQuestionsAnsweredStudentAndClass = function(path) {
  $.ajax({
    type: 'GET',
    url: path,
    data: {
      type: 'QuestionsAnsweredVsClass'
    },
    success: function(data) {
      $('#studentAnswered').html(data[0]);
      $('#classAnswered').html(data[1]);
    },
    error: function(data) {
      if (data['status'] === 401) {
        window.location.href = '/';
      } else if (data['status'] === 500) {
        $('#studentAnswered').html('No Data');
        $('#classAnswered').html('No Data');
      }
    }
  });
}

var getAccuracyStudentAndClass = function(path) {
  $.ajax({
    type: 'GET',
    url: path,
    data: {
      type: 'AccuracyVsClass'
    },
    success: function(data) {
      $('#studentAccuracy').html(data[0]);
      $('#classAccuracy').html(data[1]);
    },
    error: function(data) {
      if (data['status'] === 401) {
        window.location.href = '/';
      } else if (data['status'] === 500) {
        $('#studentAccuracy').html('No Data');
        $('#classAccuracy').html('No Data');
      }
    }
  });
}

var getPointsStudentAndClass = function(path) {
  $.ajax({
    type: 'GET',
    url: path,
    data: {
      type: 'PointsVsClass'
    },
    success: function(data) {
      $('#studentPoints').html(data[0]);
      $('#classPoints').html(data[1]);
    },
    error: function(data) {
      if (data['status'] === 401) {
        window.location.href = '/';
      } else if (data['status'] === 500) {
        $('#studentPoints').html('No Data');
        $('#classPoints').html('No Data');
      }
    }
  });
}

var getRatingStudentAndClass = function(path) {
  $.ajax({
    type: 'GET',
    url: path,
    data: {
      type: 'RatingVsClass'
    },
    success: function(data) {
      $('#studentRating').html(data[0]);
      $('#classRating').html(data[1]);
    },
    error: function(data) {
      if (data['status'] === 401) {
        window.location.href = '/';
      } else if (data['status'] === 500) {
        $('#studentRating').html('No Data');
        $('#classRating').html('No Data');
      }
    }
  });
}
