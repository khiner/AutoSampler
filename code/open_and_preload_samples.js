inlets = 1;
outlets = 2;

var MAX_SAMPLES_PER_NOTE = 10;

function samplesToMillis(samples, sample_rate) {
  return (1000 / sample_rate) * samples;
}

function bang() {
  f = new File("note_to_sample_info_map.txt", "read", "text");
  
  // open section - open all files in header
  var sample_infos = [];
  while (true) {
	var line = f.readline();
	if (line == '_')
	  break;
	var sample_info = line.split('::');
	var sample_path = sample_info[0];
	outlet(0, "open", sample_path);
	sample_infos.push(sample_info);
  }

  sample_count_for_notes = {}
  while (f.position != f.eof) {
	var line = f.readline(10000);
	var note_and_segments = line.split(':');
	var note = parseInt(note_and_segments[0]);
	var segments = note_and_segments[1].split('|');
	var note_count = segments.length;
	sample_count_for_notes[note] = note_count;
	
    for (var i = 0; i < segments.length; i++) {
	  var segment = segments[i];
	  var segment_sections = segment.split(',');
	  var sample_index = parseInt(segment_sections[0]);
	  var sample_info = sample_infos[sample_index];
	  var sample_path = sample_info[0];
	  var sample_rate = sample_info[1];
	  var start_time_samples = parseFloat(segment_sections[1]);
	  var duration_samples = parseFloat(segment_sections[2]);
	  var start_time_ms = samplesToMillis(start_time_samples, sample_rate);
	  var duration_ms = samplesToMillis(duration_samples, sample_rate);
	  outlet(0, "preload", note * MAX_SAMPLES_PER_NOTE + i,
             sample_path, start_time_ms, start_time_ms + duration_ms);
	}
  }

  //outlet(0, "open", "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3");
  //outlet(0, "open", "/Users/khiner/Development/aubio/The Beatles-Hey Jude.mp3");
  //outlet(0, "preload", 460, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 97814.058957, 98673.197279);
  //outlet(0, "preload", 461, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 142860.770975, 142994.285714);
  //outlet(0, "preload", 470, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 33697.959184, 33959.183674);
  //outlet(0, "preload", 500, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 104867.120181, 105047.07483);

  var funbuff_ret = [];
  funbuff_ret.push(1);
  funbuff_ret.push("set");
  for (var key in sample_count_for_notes) {
	var val = sample_count_for_notes[key];
    funbuff_ret.push(parseInt(key));
    funbuff_ret.push(parseInt(val));
  }

  outlet.apply(this, funbuff_ret);
  //outlet(1, "set", 46, 2, 47, 1, 50, 1);
}
