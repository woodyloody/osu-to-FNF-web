var parser = module.require("osuparser");
var format = module.require('format');

module.export("osu_to_lua", function(osu_file_contents, options) {
	var rtv_lua = ""

	var append_to_output = function(str, newline) {
		rtv_lua += (str)
	}

	var beatmap = parser.parseContent(osu_file_contents)

	function track_time_hash(track,time) {
		return track + "_" + time
	}

	function hitobj_x_to_track_number(hitobj_x) {
		var track_number = 0;
		if (options.onlyp1 === false) {
			if (hitobj_x <= 32) {
				track_number = 0;
			} else if (hitobj_x <= 96) {
				track_number = 1;
			} else if (hitobj_x <= 160) {
				track_number = 2;
			} else if (hitobj_x <= 224) {
				track_number = 3;
			} else if (hitobj_x <= 288) {
				track_number = 4;
			} else if (hitobj_x <= 352) {
				track_number = 5;
			} else if (hitobj_x <= 416) {
				track_number = 6;
			} else {
				track_number = 7;
			}
		} else {
			if (hitobj_x < 100) {
				track_number = 0;
			} else if (hitobj_x < 200) {
				track_number = 1;
			} else if (hitobj_x < 360) {
				track_number = 2;
			} else {
				track_number = 3;
			}
		}
		return track_number;
	}

	function msToTime(s) {
		var ms = s % 1000;
		s = (s - ms) / 1000;
		var secs = s % 60;
		s = (s - secs) / 60;
		var mins = s % 60;
		var hrs = (s - mins) / 60;
		return hrs + ':' + mins + ':' + secs + '.' + ms;
	}

	var _tracks_next_open = {
		0: -1,
		1: -1,
		2: -1,
		3: -1,
		4: -1,
		5: -1,
		6: -1,
		7: -1
	}
	var _i_to_removes = {}

	for (var i = 0; i < beatmap.hitObjects.length; i++) {
		var itr = beatmap.hitObjects[i];
		var type = itr.objectName;
		var track = hitobj_x_to_track_number(itr.position[0]);
		var start_time = itr.startTime

		if (_tracks_next_open[track] >= start_time) {

			append_to_output(format("--ERROR: Note overlapping another. At time (%s), track(%d). (Note type(%s) number(%d))",
				msToTime(start_time),
				track,
				type,
				i
			))

			_i_to_removes[i] = true
			continue
		} else {
			_tracks_next_open[track] = start_time
		}

		if (type == "slider") {
			var end_time = start_time + itr.duration
			if (_tracks_next_open[track] >= end_time) {
				append_to_output(format("--ERROR: Note overlapping another. At time (%s), track(%d). (Note type(%s) number(%d))",
					msToTime(start_time),
					track,
					type,
					i
				))

				_i_to_removes[i] = true
				continue
			} else {
				_tracks_next_open[track] = end_time
			}

		}
	}

	beatmap.hitObjects = beatmap.hitObjects.filter(function(x,i){
		return !(_i_to_removes[i])
	})

	// you can do the hit from 0 - 7, 0 being the furthest left for player2 (dad, pico, ect...) and 7 being the furthest right for player1 (bf)
	// this means that it is possible to make one very long section that has must hit true and the player1 has to hit the notes and the opponent would hit them automatically
	// this means there is no need for making multiple sections you can compile into one section and it would be the same (but i think the cameras get messed up)
	// the last option would be to have this long section build but if possible make it multiple sections to not mess up the cameras

	// for making multiple sections check if it is player1 or player2 and try make them seperate 

	/*
	to fix the camera so it focuses on the correct person and acts like the normal fnf camera they need to be split into sections defining the person in shot with the musthit 
	this means that you must group the notes into sections by gathering the notes in the next section independent of the notes

	so for the first section you would loop through the notes checking if they are only player1 or only player2 if they are only player1 or 2 that would be the camera position
	(to check for player1 it would be if all notes are in the 4 right colums opposite side for player2)
	if there are both players then it would default to player1 for focus like in the normal fnf
	this continues for each section and the section marker is remembered indepentently 
	(for example if sections were 1000 long the first section would be checking for notes in the range of this 1000 after the check the new starting section would be 2000)
	

	need to add better page for picking the options and instructions

	*/

	console.log(beatmap);
	console.log(options);

	if (options.song === "") {
		if (beatmap.Title !== "" || beatmap.Title !== undefined) {
			options.song = beatmap.Title;
		} 
		if (options.song === undefined) {
			options.song = "songName";
		}
	}
	if (options.bpm === "") {
		options.bpm = beatmap.bpmMax;
	}
	options.bpm = parseInt(options.bpm);
	if (isNaN(options.bpm)) {
		options.bpm = 120;
	}
	if (options.player1 === "") {
		options.player1 = "bf";
	}
	if (options.player2 === "") {
		options.player2 = "dad";
	}
	if (options.speed === ""){
		options.speed = 1;
	}
	options.speed = parseFloat(options.speed);
	if (isNaN(options.speed)) {
		options.speed = 1;
	}
	

	var crotchet  = ((60 / options.bpm) * 1000);
	var stepcrotchet  = crotchet  / 4;
	var sectionlength = stepcrotchet * 16;
	var currentlength = 0;

	append_to_output(`{"song":{"player2":"${options.player2}","player1":"${options.player1}","speed":${options.speed},"needsVoices":${options.needsvoices},"sectionLengths":[],"song":"${options.song}","bpm":${options.bpm},"sections":0,"validScore":true,"notes":[`)

	if (options.onlyp1 === false){
		while (true) {
			var p1 = false;
			var p2 = false;
			
			var notes = [];
			for (var i = 0; i < beatmap.hitObjects.length; i++) {
				if (beatmap.hitObjects[i].startTime >= currentlength) {
					if (beatmap.hitObjects[i].startTime < currentlength + sectionlength) {
						if (hitobj_x_to_track_number(beatmap.hitObjects[i].position[0]) <= 3) {
							p2 = true;
						} else {
							p1 = true;
						}
						notes.push(beatmap.hitObjects[i])
					} else {
						break
					}
				}
			}
			var camera = true;
			if (p2 === false && p1 === true) {
				camera = true;
			} else if (p2 === true && p1 === false) {
				camera = false;
			} else if (p2 === true && p1 === true) {
				camera = true;
			} else if (p2 === false && p1 === false) {
				camera = true;
			}

			append_to_output(`{"mustHitSection":${camera},"typeOfSection":0,"lengthInSteps":16,"sectionNotes":[`)
	
			for (var i = 0; i < notes.length; i++) {
				append_to_output(`[${notes[i].startTime},`)
				var track = hitobj_x_to_track_number(notes[i].position[0]);
	
				if (camera === false) {
					append_to_output(track)
				} else if (camera === true && p1 === true && p2 === false) {
					append_to_output(track - 4)
				} else if (camera === true && p1 === true && p2 === true) {
					if (track > 3) {
						append_to_output(track - 4)
					} else if (track < 4) {
						append_to_output(track + 4)
					}
	
				} else if (camera === true && p2 === false && p1 === false) {
					if (track > 3) {
						append_to_output(track - 4)
					} else if (track < 4) {
						append_to_output(track + 4)
					}
				}
	
				if (notes[i].duration === undefined) {
					append_to_output(`,0]`)
				} else {
					append_to_output(`,${notes[i].duration}]`)
				}
				if (i !== notes.length - 1) {
					append_to_output(",")
				}
			}
	
			append_to_output(`]}`)
	
	
			currentlength += sectionlength;
	
			var breaking = true;
			for (var i = 0; i < beatmap.hitObjects.length; i++) {
				if (beatmap.hitObjects[i].startTime >= currentlength) {
					breaking = false;
					break;
				}
			}
			if (breaking === false) {
				append_to_output(",")
			}
			if (breaking === true){
				break;
			}
		}
	} else {
		append_to_output(`{"mustHitSection":true,"typeOfSection":0,"lengthInSteps":16,"sectionNotes":[`)
		for (var i = 0; i < beatmap.hitObjects.length; i++) {
			var itr = beatmap.hitObjects[i];
			var type = itr.objectName;
			var track = hitobj_x_to_track_number(itr.position[0]);

			append_to_output(`[${itr.startTime},${track}`)

			if (itr.duration === undefined) {
				append_to_output(`,0]`)
			} else {
				append_to_output(`,${itr.duration}]`)
			}
			if (i !== beatmap.hitObjects.length - 1) {
				append_to_output(",")
			}
		}
		append_to_output(`]}`)
	}

	append_to_output(`]}}`)

	return rtv_lua
})
