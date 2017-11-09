/*
log.js

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

var fs = require('fs');
var common = require('./common.js');
var logger = fs.createWriteStream('logs/'+common.getDateByFormat('YYYY-MM-DD')+'.log', {'flags':'a'});

process.stdout.write = process.stderr.write = logger.write.bind(logger);
process.on(
  'uncaughtException',
  function(err)
  {
    console.error((err && err.stack) ? err.stack : err);
  }
);

console.log('Testing logger');
logger = fs.createWriteStream('logs/'+common.getDateByFormat('YYYY-MM-DD')+'.log', {'flags':'a'});