inlets = 1;
outlets = 2;

function samplesToMillis(samples, sample_rate) {
  return (1000 / sample_rate) * samples;
}

function openSampleMap(sample_info_map_path, max_samples_per_note) {
  post(sample_info_map_path);
  f = new File(sample_info_map_path, "read", "text");
  
  // open section - open all files in header
  var sample_infos = [];
  while (true) {
	var line = f.readline();
	if (line == '_')
	  break;
	var sample_info = line.split('::');
	var sample_path = sample_info[0];
	outlet(1, "open", sample_path);
	sample_infos.push(sample_info);
  }

  sample_count_for_notes = {}
  while (f.position != f.eof) {
	var line = f.readline(10000);
	var note_and_segments = line.split(':');
	var note = parseInt(note_and_segments[0]);
	var segments = note_and_segments[1].split('|').slice(0, max_samples_per_note);
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
	  outlet(1, "preload", note * max_samples_per_note + i,
             sample_path, start_time_ms, start_time_ms + duration_ms);
	}
  }

  var funbuff_ret = [];
  funbuff_ret.push(0);
  funbuff_ret.push("setSampleCounts");
  for (var midi_note = 0; midi_note < 128; midi_note++) {
	var sample_count = sample_count_for_notes[midi_note];
	if (!sample_count) {
		sample_count = 0;
	}
    funbuff_ret.push(midi_note);
    funbuff_ret.push(sample_count);
  }

  outlet.apply(this, funbuff_ret);
}
