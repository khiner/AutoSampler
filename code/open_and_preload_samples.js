inlets = 1;
outlets = 1;

var MAX_SAMPLES_PER_NOTE = 10;

function bang() {
  f = new File("note_to_sample_info_map.txt", "read", "text");
  
  // open section - open all files in header
  var sample_paths = [];
  while (true) {
	var line = f.readline();
	if (line == '_')
	  break;
	var sample_path = line.substr(0, line.indexOf('::'));
	outlet(0, "open", sample_path);
	sample_paths.push(sample_path);
  }

  while (f.position != f.eof) {
	var line = f.readline(10000);
	var note_and_segments = line.split(':');
	var note = parseInt(note_and_segments[0]);
	var segments = note_and_segments[1].split('|');
	var note_count = segments.length;
	for (var i = 0; i < segments.length; i++) {
	  var segment = segments[i];
	  var segment_sections = segment.split(',');
	  var sample_index = parseInt(segment_sections[0]);
	  var start_time_ms = parseFloat(segment_sections[1]);
	  var end_time_ms = parseFloat(segment_sections[2]);
	  outlet(0, "preload", note * MAX_SAMPLES_PER_NOTE + i,
             sample_paths[sample_index], start_time_ms, end_time_ms);
	}
  }

  //outlet(0, "open", "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3");
  //outlet(0, "open", "/Users/khiner/Development/aubio/The Beatles-Hey Jude.mp3");
  //outlet(0, "preload", 460, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 97814.058957, 98673.197279);
  //outlet(0, "preload", 461, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 142860.770975, 142994.285714);
  //outlet(0, "preload", 470, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 33697.959184, 33959.183674);
  //outlet(0, "preload", 500, "/Users/khiner/Development/aubio/python/scripts/Be I Do (Jameszoo Remix).mp3", 104867.120181, 105047.07483);
}
