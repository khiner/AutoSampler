inlets = 4;
outlets = 4;

/********INPUTS*****************
 * 0: note (int) OR bang (play) OR message (openSampleMap)
 * 1: sample-choice type (int)
 * 2: current_sample (list)
 * 3: sample_selector (float) OR steal_samples (int: 0 or 1)
********************************/

/********OUTPUTS*****************
 * 0: output messages to sfplay
 * 1: playback rate for sfplay
 * 2: next_playing_display (list) - binary list showing which sample index to show selected state for
 * 3: output messages to thispatcher
********************************/

var MAX_SAMPLES_PER_NOTE = 24;
var MAX_MIDI_NOTE_VALUE = 127;

/*** LOOP MODES ***/
var PICK = 0;
var CYCLE = 1;
var RANDOM = 2;

var sample_count_for_note = [];
var enabled_samples_for_note;
var curr_sample_index_for_note;
var active_samples; // binary list of sample indices to display as up next
var curr_note = 0;
var loop_type = 0;
var nearest_note_with_samples = [];
var steal_samples = true;

function createAndFillArray(length, fillValue) {
  var array = [];
  for (var i = 0; i < length; i++)
    array.push(fillValue);
  return array;
}

function samplesToMillis(samples, sample_rate) {
  return (1000 / sample_rate) * samples;
}

// the played note may have no samples.
// this function returns the nearest note with samples if the 'steal samples' toggle is checked
// otherwise, it returns the acutall current played note (with no samples)
function nearestNoteWithSamples(note) {
  if (!steal_samples || sample_count_for_note[note] > 0)
    return note;

  return nearest_note_with_samples[note] != null ? nearest_note_with_samples[note] : note;
}

function currentNoteWithSamples() {
  return nearestNoteWithSamples(curr_note);
}

function getSampleCountForNote(note) {
  return sample_count_for_note[note];
}

function getSampleCount() {
  return getSampleCountForNote(currentNoteWithSamples());
}

function setSampleCountForNote(sample_count, note) {
  sample_count_for_note[note] = sample_count;
}

function getSampleIndex() {
  return curr_sample_index_for_note[curr_note];
}

function setSampleIndex(sample_index) {
  curr_sample_index_for_note[curr_note] = sample_index;
}

function getEnabledSampleMask() {
  return enabled_samples_for_note[curr_note];
}

function setEnabledSampleMask(enabled_sample_mask) {
  enabled_samples_for_note[curr_note] = enabled_sample_mask;
}

function enableSampleForNote(sample_index, note) {
  enabled_samples_for_note[note] = enabled_samples_for_note[note] | (1 << sample_index);
}

function enableSample(sample_index) {
  enableSampleForNote(sample_index, curr_note);
}

function isSampleEnabled(sample_index) {
  return (getEnabledSampleMask() & (1 << sample_index)) != 0
}

function isCurrentSampleEnabled() {
  return isSampleEnabled(getSampleIndex())
}

function outputActiveSamples() {
  for (var sample_index = 0; sample_index < active_samples.length; sample_index++)
	active_samples[sample_index] = 0;

  var sample_index = getSampleIndex();
  if (sample_index >= 0 && sample_index < active_samples.length)
	active_samples[sample_index] = 1;

  outlet(2, active_samples);
}

function findNextSampleIndex(is_new_note) {
  if (getEnabledSampleMask() == 0)
	return; // no samples enabled

  var prev_sample_index = getSampleIndex();
  var sample_count = getSampleCount();

  if (loop_type == RANDOM)
    setSampleIndex(Math.floor(Math.random() * sample_count));
  else if (loop_type == CYCLE)
    setSampleIndex((getSampleIndex() + 1) % sample_count)

  while (!isCurrentSampleEnabled())
	setSampleIndex((getSampleIndex() + 1) % sample_count);

  if (is_new_note || getSampleIndex() != prev_sample_index)
    outputActiveSamples();
}

function showToggles() {
  var sample_count = getSampleCount();

  for (var sample_index = 0; sample_index < MAX_SAMPLES_PER_NOTE; sample_index++) {
	var show_or_hide = (sample_index < sample_count) ? 'show' : 'hide';
	outlet(3, 'script', show_or_hide, 'sampLed' + (sample_index + 1));
	outlet(3, 'script', show_or_hide, 'sampToggle' + (sample_index + 1));
	if (sample_index < sample_count)
	  outlet(3, 'script', 'send', 'sampToggle' + (sample_index + 1), 'set', isSampleEnabled(sample_index) ? 1 : 0);
  }
}

function playNextSample(is_new_note) {
  findNextSampleIndex(is_new_note);
  if (isCurrentSampleEnabled()) {
	var corrected_curr_note = currentNoteWithSamples();
	var sample_rate = corrected_curr_note != curr_note ? 1 + (curr_note - corrected_curr_note) / 12.0 : 1;
	post(sample_rate);
	outlet(1, sample_rate);
    outlet(0, MAX_SAMPLES_PER_NOTE * corrected_curr_note + getSampleIndex());
  }
}

/*** INPUT METHODS ***/

function loadbang() {
  active_samples = createAndFillArray(MAX_SAMPLES_PER_NOTE, 0);
  curr_sample_index_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
  enabled_samples_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
}

function bang() { // play
  playNextSample(false);
}

function msg_int(arg) {
  if (inlet == 0) {
	if (arg == 0)
	  return;
	var prev_note = curr_note;
	curr_note = arg;
	if (prev_note != curr_note)
	  showToggles();
	playNextSample(true);
  } else if (inlet == 1) {
	loop_type = arg;
  } else if (inlet == 3) {
	steal_samples = arg == 1 ? true : false;
	showToggles();
  }
}

function msg_float(arg) {
  if (loop_type == PICK || loop_type == REPEAT) {
	var prev_sample_index = getSampleIndex();
	setSampleIndex(Math.floor(arg * getSampleCount() - 1));
	findNextSampleIndex(prev_sample_index != getSampleIndex());
  }
}

function list() {
  var enabled_sample_array = arrayfromargs(messagename, arguments);
  setEnabledSampleMask(0);
  for (var sample_index = 0; sample_index < getSampleCount(); sample_index++)
	if (enabled_sample_array[sample_index] == 1)
	  enableSample(sample_index);
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
	outlet(0, "open", sample_path);
	sample_infos.push(sample_info);
  }

  while (f.position != f.eof) {
	var line = f.readline(10000);
	var note_and_segments = line.split(':');
	var note = parseInt(note_and_segments[0]);
	var segments = note_and_segments[1].split('|').slice(0, MAX_SAMPLES_PER_NOTE);
	setSampleCountForNote(segments.length, note);

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

  for (var note = 0; note <= MAX_MIDI_NOTE_VALUE; note++)
	if (getSampleCountForNote(note) == null)
	    setSampleCountForNote(0, note);
	
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
	var nearest_note = nearestNoteWithSamples(note);
	var sample_count = getSampleCountForNote(nearest_note);
	for (var sample_index = 0; sample_index < sample_count; sample_index++) {
      enableSampleForNote(sample_index, note);
    }
  }
}