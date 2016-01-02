	inlets = 4;
outlets = 5;

/********INPUTS*****************
 * 0: note (int) OR bang (play) OR message (openSampleMap)
 * 1: sample-choice-type (int) OR sample-number (float)
 * 2: current_sample (list) OR sample-level (float)
 * 3: pick (float) OR steal_samples (int: 0 or 1)
********************************/

/********OUTPUTS*****************
 * 0: output messages to sfplay
 * 1: playback rate for sfplay
 * 2: next_playing_display (list) - binary list showing which sample index to show selected state for OR output_level (float)
 * 3: output messages to thispatcher
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
var sample_index_for_cue = [];
var enabled_samples_for_note;
var curr_sample_index_for_note;
var active_samples; // binary list of sample indices to display as up next
var curr_note = 0;
var loop_type = 0;
var nearest_note_with_samples = [];
var steal_samples = true;
var level_for_sample = [];

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

function getSampleIndex() {
  return curr_sample_index_for_note[curr_note];
}

function setSampleIndex(sample_index) {
  outlet(4, level_for_sample[MAX_SAMPLES_PER_NOTE * curr_note + sample_index]);
  curr_sample_index_for_note[curr_note] = sample_index;
  updateSampleUi();
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
  return (getEnabledSampleMask() & (1 << sample_index)) != 0;
}

function isCurrentSampleEnabled() {
  return isSampleEnabled(getSampleIndex());
}

function outputActiveSamples() {
  for (var sample_index = 0; sample_index < active_samples.length; sample_index++)
	active_samples[sample_index] = 0;

  var sample_index = getSampleIndex();
  if (sample_index >= 0 && sample_index < active_samples.length)
	active_samples[sample_index] = 1;

  outlet(2, active_samples);
}

function findNextSampleIndex() {
  if (getEnabledSampleMask() == 0)
	return; // no samples enabled

  var prev_sample_index = getSampleIndex();
  var sample_count = getSampleCount();

  if (loop_type == RANDOM)
    setSampleIndex(Math.floor(Math.random() * sample_count));
  else if (loop_type == CYCLE_X || (loop_type == CYCLE_Y && sample_count <= MAX_SAMPLES_PER_NOTE / 4))
    setSampleIndex((prev_sample_index + 1) % Math.min(sample_count, MAX_SAMPLES_PER_NOTE));
  else if (loop_type == CYCLE_Y) {
	var next_sample_index = prev_sample_index + MAX_SAMPLES_PER_NOTE / 4;
	if (next_sample_index >= Math.min(sample_count, MAX_SAMPLES_PER_NOTE))
	  next_sample_index = ((next_sample_index % SAMPLE_ROW_SIZE) + 1) % Math.min(sample_count, SAMPLE_ROW_SIZE);
    setSampleIndex(next_sample_index);
  }

  while (!isCurrentSampleEnabled())
	setSampleIndex((getSampleIndex() + 1) % sample_count);

  outputActiveSamples();
}

function updateSampleUiAndToggles() {
  var sample_count = getSampleCount();

  for (var sample_index = 0; sample_index < MAX_SAMPLES_PER_NOTE; sample_index++) {
	var show_or_hide = (sample_index < sample_count) ? 'show' : 'hide';
	outlet(3, 'script', show_or_hide, 'sampLed' + (sample_index + 1));
	outlet(3, 'script', show_or_hide, 'sampToggle' + (sample_index + 1));
	if (sample_index < sample_count)
	  outlet(3, 'script', 'send', 'sampToggle' + (sample_index + 1), 'set', isSampleEnabled(sample_index) ? 1 : 0);
  }
  updateSampleUi();
}

function updateSampleUi() {
  if (!getSampleCount() || curr_note == 0) {
	outlet(3, 'script', 'hide', 'sampleLevel');
	outlet(3, 'script', 'hide', 'nextSampleButton');
	outlet(3, 'script', 'hide', 'nextSampleLabel');
  } else {
    outlet(3, 'script', 'send', 'sampleLevel', level_for_sample[MAX_SAMPLES_PER_NOTE * curr_note + getSampleIndex()]);
    outlet(3, 'script', 'show', 'sampleLevel');
    outlet(3, 'script', 'show', 'nextSampleButton');
    outlet(3, 'script', 'show', 'nextSampleLabel');
  }
}

function playNextSample() {
  findNextSampleIndex();
  if (isCurrentSampleEnabled()) {
	var corrected_curr_note = nearestNoteWithSamples();
    outlet(0, MAX_SAMPLES_PER_NOTE * nearestNoteWithSamples() + getSampleIndex());
  }
}

/*** INPUT METHODS ***/

function loadbang() {
  active_samples = createAndFillArray(MAX_SAMPLES_PER_NOTE, 0);
  curr_sample_index_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
  enabled_samples_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
}

function bang() {
  if (inlet == 0) {
    playNextSample();
  } else if (inlet == 2) { // swap out sample for this bucket
	var sample_infos = sample_infos_for_note[nearestNoteWithSamples()];
	if (sample_infos) {
	  var cue_number = MAX_SAMPLES_PER_NOTE * nearestNoteWithSamples() + getSampleIndex();
	  sample_index_for_cue[cue_number] = (sample_index_for_cue[cue_number] + 1) % getSampleCount();
	  var sample_info = sample_infos[sample_index_for_cue[cue_number]];
	  if (sample_info) {
	    //outlet(0, 'clear', cue_number);
        outlet(0, 'preload', cue_number, sample_info.sample_path, sample_info.start_time_ms, sample_info.start_time_ms + sample_info.duration_ms);
      }
    }
  }
}

function msg_int(arg) {
  if (inlet == 0) {
	if (arg == 0)
	  return;
	var prev_note = curr_note;
	curr_note = arg;
	if (prev_note != curr_note) {
	  var sample_rate = nearestNoteWithSamples() != curr_note ? 1 + (curr_note - nearestNoteWithSamples()) / 12.0 : 1;
	  outlet(1, sample_rate);
	  updateSampleUiAndToggles();
	}
	if (!quantized)
	  playNextSample();
  } else if (inlet == 1) {
	loop_type = arg;
  } else if (inlet == 2) {
	quantized = arg > 1; // 0 == no retrigger, 1 == EOS, 2-N == quantized
  } else if (inlet == 3) {
	steal_samples = arg == 1 ? true : false;
	if (sample_count_for_note[curr_note] == 0) {
      updateSampleUiAndToggles();
	}
  }
}

function msg_float(arg) {
  if (inlet == 1) { // sample-level
	level_for_sample[MAX_SAMPLES_PER_NOTE * curr_note + getSampleIndex()] = arg;
	outlet(4, arg);
  } else if (inlet == 3) { // pick
    if (loop_type == PICK || loop_type == REPEAT) {
	  setSampleIndex(Math.floor(arg * (Math.min(MAX_SAMPLES_PER_NOTE, getSampleCount()) - 1)));
	  findNextSampleIndex();
    }
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
	var segments = note_and_segments[1].split('|')
	setSampleCountForNote(segments.length, note);
    sample_infos_for_note[note] = [];

    for (var i = 0; i < segments.length; i++) {
	  var segment = segments[i];
	  var segment_sections = segment.split(',');
	  var sample_index = parseInt(segment_sections[0]);
	  var sample_info = sample_infos[sample_index];
	  var sample_rate = sample_info[1];

	  var sample_info_obj = {};
      sample_info_obj.sample_path = sample_info[0];
	  sample_info_obj.start_time_ms = samplesToMillis(parseFloat(segment_sections[1]), sample_rate);
	  sample_info_obj.duration_ms = samplesToMillis(parseFloat(segment_sections[2]), sample_rate);
      sample_infos_for_note[note][i] = sample_info_obj;

      if (i < MAX_SAMPLES_PER_NOTE) {
  	    var cue_number = note * MAX_SAMPLES_PER_NOTE + i;
	    level_for_sample[cue_number] = 0;
	    sample_index_for_cue[cue_number] = i;
	    outlet(0, 'preload', cue_number, sample_info_obj.sample_path, sample_info_obj.start_time_ms, sample_info_obj.start_time_ms + sample_info_obj.duration_ms);
	  }
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
	var nearest_note = nearestNoteWithSamplesForNote(note);
	var sample_count = getSampleCountForNote(nearest_note);
	for (var sample_index = 0; sample_index < sample_count; sample_index++) {
      enableSampleForNote(sample_index, note);
    }
  }
}