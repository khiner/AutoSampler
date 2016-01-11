inlets = 5;
outlets = 6;

/********INPUTS*****************
 * 0: note (int) OR bang (play) OR message (openSampleMap)
 * 1: sample-choice-type (int) OR sample-level (float)
 * 2: current_sample (list)
 * 3: pick (float) OR steal_samples (int: 0 or 1)
 * 4: reverse (int: 0 or 1)
********************************/

/********OUTPUTS*****************
 * 0: output messages to sfplay
 * 1: playback rate for sfplay
 * 2: next_playing_display (list) - binary list showing which sample index to show selected state for OR output_level (float)
 * 3: output messages to thispatcher
 * 4: level (float)
 * 5: sample_offset_label (string)
********************************/

var SAMPLE_ROW_SIZE = 4;
var MAX_SAMPLES_PER_NOTE = SAMPLE_ROW_SIZE * SAMPLE_ROW_SIZE;
var MAX_MIDI_NOTE_VALUE = 127;

/*** LOOP MODES ***/
var PICK = 0;
var CYCLE_X = 1;
var CYCLE_Y = 2;
var RANDOM = 3;

var quantized = false;
var sample_infos_for_note = [];
var sample_count_for_note = [];
var sample_offset_for_cue = [];
var enabled_samples_for_note;
var curr_sample_offset_for_note;
var active_samples; // binary list of sample indices to display as up next
var curr_note = 0;
var loop_type = 0;
var nearest_note_with_samples = [];
var steal_samples = true;
var level_for_sample = [];
var playback_speed_for_sample = [];
var prev_playback_speed = 0;

function createAndFillArray(length, fillValue) {
  var array = [];
  for (var i = 0; i < length; i++)
    array.push(fillValue);
  return array;
}

function shuffle(a) {
  for (var j, x, i = a.length; i; j = Math.floor(Math.random() * i), x = a[--i], a[i] = a[j], a[j] = x);
  return a;
}

function samplesToMillis(samples, sample_rate) {
  return (1000.0 / sample_rate) * samples;
}

// the played note may have no samples.
// this function returns the nearest note with samples if the 'steal samples' toggle is checked
// otherwise, it returns the acutall current played note (with no samples)
function nearestNoteWithSamplesForNote(note) {
  if (!steal_samples || sample_count_for_note[note] > 0)
    return note;

  return nearest_note_with_samples[note] != null ? nearest_note_with_samples[note] : note;
}

function nearestNoteWithSamples() {
  return nearestNoteWithSamplesForNote(curr_note);
}

function getSampleCountForNote(note) {
  return sample_count_for_note[note];
}

function getSampleCount() {
  return getSampleCountForNote(nearestNoteWithSamples());
}

function setSampleCountForNote(sample_count, note) {
  sample_count_for_note[note] = sample_count;
}

function getSampleOffset() {
  return curr_sample_offset_for_note[curr_note];
}

function getSampleIndexForNote(note) {
  return MAX_SAMPLES_PER_NOTE * note + getSampleOffset();
}

function getSampleIndex() {
  return getSampleIndexForNote(curr_note);
}

function setSampleOffset(sample_offset) {
  curr_sample_offset_for_note[curr_note] = sample_offset;
  var sample_index = getSampleIndex();
  outlet(4, level_for_sample[sample_index]);
  updateSampleUi();
}

function getEnabledSampleMask() {
  return enabled_samples_for_note[curr_note];
}

function setEnabledSampleMask(enabled_sample_mask) {
  enabled_samples_for_note[curr_note] = enabled_sample_mask;
}

function enableSampleForNote(sample_offset, note) {
  enabled_samples_for_note[note] = enabled_samples_for_note[note] | (1 << sample_offset);
}

function enableSample(sample_offset) {
  enableSampleForNote(sample_offset, curr_note);
}

function isSampleEnabled(sample_offset) {
  return (getEnabledSampleMask() & (1 << sample_offset)) != 0;
}

function isCurrentSampleEnabled() {
  return isSampleEnabled(getSampleOffset());
}

function outputSampleLabel(cue_number) {
  outlet(5, '' + (sample_offset_for_cue[cue_number] + 1) + ' of ' + getSampleCount());
}

function loadSampleForCue(cue_number, sample_offset) {
  var note = nearestNoteWithSamples();
  var sample_infos = sample_infos_for_note[note];
  if (sample_infos) {
    sample_offset_for_cue[cue_number] = sample_offset;
    var sample_info = sample_infos[sample_offset_for_cue[cue_number]];
    if (sample_info) {
      outlet(0, 'preload', cue_number, sample_info.sample_path, sample_info.start_time_ms, sample_info.start_time_ms + sample_info.duration_ms);
      var curr_cue_number = getSampleIndexForNote(note);
      if (cue_number === curr_cue_number) {
	    outputSampleLabel(cue_number);
      }
    }
  }
}

function outputActiveSamples() {
  for (var sample_offset = 0; sample_offset < active_samples.length; sample_offset++)
	active_samples[sample_offset] = 0;

  var sample_offset = getSampleOffset();
  if (sample_offset >= 0 && sample_offset < active_samples.length)
	active_samples[sample_offset] = 1;

  outlet(2, active_samples);
  outputSampleLabel(getSampleIndexForNote(nearestNoteWithSamples()));
}

function findNextSample() {
  if (getEnabledSampleMask() == 0)
	return; // no samples enabled

  var prev_sample_offset = getSampleOffset();
  var sample_count = getSampleCount();

  if (loop_type == RANDOM) {
    setSampleOffset(Math.floor(Math.random() * sample_count));
    while (!isCurrentSampleEnabled())
	  setSampleOffset((getSampleOffset() + 1) % sample_count);
  } else if (loop_type == CYCLE_X || (loop_type == CYCLE_Y && sample_count <= SAMPLE_ROW_SIZE))
    setSampleOffset((prev_sample_offset + 1) % Math.min(sample_count, MAX_SAMPLES_PER_NOTE));
  else if (loop_type == CYCLE_Y) {
	var next_sample_offset = prev_sample_offset + SAMPLE_ROW_SIZE;
	if (next_sample_offset >= Math.min(sample_count, MAX_SAMPLES_PER_NOTE))
	  next_sample_offset = ((next_sample_offset % SAMPLE_ROW_SIZE) + 1) % Math.min(sample_count, SAMPLE_ROW_SIZE);
    setSampleOffset(next_sample_offset);
  } else if (!isCurrentSampleEnabled()) {
    setSampleOffset((getSampleOffset() + 1) % sample_count);
  }

  while (!isCurrentSampleEnabled())
	findNextSample();

  outputActiveSamples();
}

function updateSampleUi() {
  if (!getSampleCount() || curr_note == 0) {
	outlet(3, 'script', 'hide', 'sampleLevel');
	outlet(3, 'script', 'hide', 'browseSample');
	outlet(3, 'script', 'hide', 'browseSampleLabel');
    //outlet(3, 'script', 'hide', 'reverseToggle');
    //outlet(3, 'script', 'hide', 'reverseLabel');
    outlet(3, 'script', 'hide', 'halveButton');
    outlet(3, 'script', 'hide', 'halveLabel');
    outlet(3, 'script', 'hide', 'doubleButton');
    outlet(3, 'script', 'hide', 'doubleLabel');
  } else {
    outlet(3, 'script', 'send', 'sampleLevel', level_for_sample[getSampleIndex()]);
    outlet(3, 'script', 'show', 'sampleLevel');
    outlet(3, 'script', 'show', 'browseSample');
    outlet(3, 'script', 'show', 'browseSampleLabel');
    //outlet(3, 'script', 'send', 'reverseToggle', 'set', playback_speed_for_sample[getSampleIndex()] < 0 ? 1 : 0);
    //outlet(3, 'script', 'show', 'reverseToggle');
    //outlet(3, 'script', 'show', 'reverseLabel');
    outlet(3, 'script', 'show', 'halveButton');
    outlet(3, 'script', 'show', 'halveLabel');
    outlet(3, 'script', 'show', 'doubleButton');
    outlet(3, 'script', 'show', 'doubleLabel');
  }
}

function updateSampleUiAndToggles() {
  var sample_count = getSampleCount();

  for (var sample_offset = 0; sample_offset < MAX_SAMPLES_PER_NOTE; sample_offset++) {
	var show_or_hide = (sample_offset < sample_count) ? 'show' : 'hide';
	outlet(3, 'script', show_or_hide, 'sampLed' + (sample_offset + 1));
	outlet(3, 'script', show_or_hide, 'sampToggle' + (sample_offset + 1));
	if (sample_offset < sample_count)
	  outlet(3, 'script', 'send', 'sampToggle' + (sample_offset + 1), 'set', isSampleEnabled(sample_offset) ? 1 : 0);
  }
  updateSampleUi();
}

function incrementSample(increment) {
  var cue_number = getSampleIndexForNote(nearestNoteWithSamples());
  loadSampleForCue(cue_number, mod(sample_offset_for_cue[cue_number] + increment, getSampleCount()));
}

function playNextSample() {
  findNextSample();
  if (isCurrentSampleEnabled()) {
	var playback_speed = playback_speed_for_sample[getSampleIndex()];
	if ((prev_playback_speed <= 0 && playback_speed > 0) ||
	    (prev_playback_speed > 0 && playback_speed < 0)) {
	  // hack
	  //incrementSample(0);
	  //var now = new Date().getTime();
      //while(new Date().getTime() < now + 100) { /* do nothing */ } 
    }
	outlet(1, playback_speed);
    outlet(0, getSampleIndexForNote(nearestNoteWithSamples()));
   	prev_playback_speed = playback_speed;
  }
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

/*** INPUT METHODS ***/

function loadbang() {
  active_samples = createAndFillArray(MAX_SAMPLES_PER_NOTE, 0);
  curr_sample_offset_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
  enabled_samples_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
}

function left() {
  incrementSample(-1);
}

function right() {
  incrementSample(1);
}

function bang() {
  if (inlet == 0) {
    playNextSample();
  } else if (inlet == 1) {
	var sample_count = getSampleCount();
	var all_indices = [];
	for (var i = 0; i < sample_count; i++) all_indices.push(i);
	shuffle(all_indices);
	var note = nearestNoteWithSamples();
	for (var sample_offset = 0; sample_offset < Math.min(sample_count, MAX_SAMPLES_PER_NOTE); sample_offset++) {
	  loadSampleForCue(MAX_SAMPLES_PER_NOTE * note + sample_offset, all_indices[sample_offset]);
    }
  } else if (inlet == 2 || inlet == 3) {
	// divide playback rate
	var sample_index = getSampleIndex();
	playback_speed_for_sample[sample_index] *= (inlet == 2 ? 0.5 : 2);
	outlet(1, playback_speed_for_sample[sample_index]);
  }
}

function msg_int(arg) {
  if (inlet == 0 && arg != 0) {
	var prev_note = curr_note;
	curr_note = arg;
	if (prev_note != curr_note) {
	  updateSampleUiAndToggles();
	}
	if (!quantized)
	  playNextSample();
  } else if (inlet == 1) {
	loop_type = arg;
  } else if (inlet == 2) {
	quantized = arg > 1; // 0 == no retrigger, 1 == EOS, 2-N == quantized
  } else if (inlet == 3) {
	steal_samples = (arg == 1);
	if (sample_count_for_note[curr_note] == 0) {
      updateSampleUiAndToggles();
	}
  } else if (inlet == 4) {
	var sample_index = getSampleIndex();
	playback_speed_for_sample[sample_index] = -playback_speed_for_sample[sample_index];
  }
}

function msg_float(arg) {
  if (inlet == 1) { // sample-level
	level_for_sample[getSampleIndex()] = arg;
	outlet(4, arg);
  } else if (inlet == 3) { // pick
    if (loop_type == PICK || loop_type == REPEAT) {
	  setSampleOffset(Math.floor(arg * (Math.min(MAX_SAMPLES_PER_NOTE, getSampleCount()) - 1)));
	  findNextSample();
    }
  }
}

function list() {
  var enabled_sample_array = arrayfromargs(messagename, arguments);
  setEnabledSampleMask(0);
  for (var sample_offset = 0; sample_offset < getSampleCount(); sample_offset++)
	if (enabled_sample_array[sample_offset] == 1)
	  enableSample(sample_offset);
}

function openSampleMap(sample_info_map_path) {
  f = new File(sample_info_map_path, "read", "text");
  
  // open section - open all files in header
  var sample_infos = [];
  while (true) {
	var line = f.readline();
	if (line == '_')
	  break;
	var sample_info = line.split('::');
	var sample_path = sample_info[0];
	outlet(0, 'open', sample_path);
	sample_infos.push(sample_info);
  }

  while (f.position != f.eof) {
	var line = f.readline(100000);
	var note_and_segments = line.split(':');
	var note = parseInt(note_and_segments[0]);
	var segments = note_and_segments[1].split('|')
	setSampleCountForNote(segments.length, note);
    sample_infos_for_note[note] = [];

    for (var i = 0; i < segments.length; i++) {
	  var segment = segments[i];
	  var segment_sections = segment.split(',');
	  var sample_offset = parseInt(segment_sections[0]);
	  var sample_info = sample_infos[sample_offset];
	  var sample_rate = sample_info[1];

	  var sample_info_obj = {};
      sample_info_obj.sample_path = sample_info[0];
	  sample_info_obj.start_time_ms = samplesToMillis(parseFloat(segment_sections[1]), sample_rate);
	  sample_info_obj.duration_ms = samplesToMillis(parseFloat(segment_sections[2]), sample_rate);
      sample_infos_for_note[note][i] = sample_info_obj;

      if (i < MAX_SAMPLES_PER_NOTE) {
  	    var cue_number = note * MAX_SAMPLES_PER_NOTE + i;
	    level_for_sample[cue_number] = 0;
	    playback_speed_for_sample[cue_number] = 1;
	    sample_offset_for_cue[cue_number] = i;
	    outlet(0, 'preload', cue_number, sample_info_obj.sample_path, sample_info_obj.start_time_ms, sample_info_obj.start_time_ms + sample_info_obj.duration_ms);
	  }
	}
  }

  for (var note = 0; note <= MAX_MIDI_NOTE_VALUE; note++) {
	if (getSampleCountForNote(note) == null) {
	  setSampleCountForNote(0, note);
	}
  }

  for (var note = 0; note <= MAX_MIDI_NOTE_VALUE; note++) {
	if (getSampleCountForNote(note) == 0) {
	  // find nearest note with samples
	  for (var distance = 0;
           note + distance <= MAX_MIDI_NOTE_VALUE ||
           note - distance > 0;
           distance++) {
	    if (getSampleCountForNote(note - distance) > 0) {
		  nearest_note_with_samples[note] = note - distance;
		  break;
		} else if (getSampleCountForNote(note + distance) > 0) {
		  nearest_note_with_samples[note] = note + distance;
		  break;
		}
	  }
	}
	var nearest_note = nearestNoteWithSamplesForNote(note);
	var sample_count = getSampleCountForNote(nearest_note);
	for (var sample_offset = 0; sample_offset < sample_count; sample_offset++) {
      enableSampleForNote(sample_offset, note);
	  playback_speed_for_sample[MAX_SAMPLES_PER_NOTE * note + sample_offset] = 1 + (note - nearest_note) / 12.0;
    }
  }
}