inlets = 4;
outlets = 3;

/********INPUTS*****************
 * 0: note (int) OR bang (play)
 * 1: loop type (int)
 * 2: current_sample (list)
 * 3: sample_selector (float)
********************************/

/********OUTPUTS*****************
 * 0: sample_index (int) - sample to play *now*
 * 1: next_playing_display (list) - binary list showing which sample index to show selected state for
 * 2: output messages to thispatcher
********************************/

var MAX_SAMPLES_PER_NOTE = 24;
var MAX_MIDI_NOTE_VALUE = 127;

/*** LOOP MODES ***/
var NO_LOOP = 0;
var REPEAT = 1;
var CYCLE = 2;
var RANDOM = 3;

var sample_count_for_note = [];
var enabled_samples_for_note;
var curr_sample_index_for_note;
var active_samples; // binary list of sample indices to display as up next
var curr_note = 0;
var loop_type = 0;

function createAndFillArray(length, fillValue) {
  var array = [];
  for (var i = 0; i < length; i++)
    array.push(fillValue);
  return array;
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

  outlet(1, active_samples);
}

function findNextSampleIndex(is_new_note) {
  if (getEnabledSampleMask() == 0)
	return; // no samples enabled

  var prev_sample_index = getSampleIndex();
  var sample_count = sample_count_for_note[curr_note];

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
  var sample_count = sample_count_for_note[curr_note];

  for (var sample_index = 0; sample_index < MAX_SAMPLES_PER_NOTE; sample_index++) {
	var show_or_hide = (sample_index < sample_count) ? 'show' : 'hide';
	outlet(2, 'script', show_or_hide, 'sampLed' + (sample_index + 1));
	outlet(2, 'script', show_or_hide, 'sampToggle' + (sample_index + 1));
	if (sample_index < sample_count)
	  outlet(2, 'script', 'send', 'sampToggle' + (sample_index + 1), 'set', isSampleEnabled(sample_index) ? 1 : 0);
  }
}

function playNextSample(is_new_note) {
  findNextSampleIndex(is_new_note);
  if (isCurrentSampleEnabled())
    outlet(0, MAX_SAMPLES_PER_NOTE * curr_note + getSampleIndex());
}

/*** INPUT METHODS ***/

function loadbang() {
  post('calling loadbang');
  active_samples = createAndFillArray(MAX_SAMPLES_PER_NOTE, 0);
  curr_sample_index_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
  enabled_samples_for_note = createAndFillArray(MAX_MIDI_NOTE_VALUE, 0);
}

function bang() { // play
  if (loop_type != NO_LOOP)
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
  }
}

function msg_float(arg) {
  if (loop_type == NO_LOOP || loop_type == REPEAT) {
	var prev_sample_index = getSampleIndex();
	setSampleIndex(Math.floor(arg * getSampleIndex() - 1));
	findNextSampleIndex(prev_sample_index != getSampleIndex());
  }
}

function list() {
  var enabled_sample_array = arrayfromargs(messagename, arguments);
  setEnabledSampleMask(0);
  for (var sample_index = 0; sample_index < sample_count_for_note[curr_note]; sample_index++)
	if (enabled_sample_array[sample_index] == 1)
	  enableSample(sample_index);
}

function setSampleCounts(args) {
  var interlaced_notes_and_sample_counts = arrayfromargs(messagename, arguments);

  for (var i = 1; i < interlaced_notes_and_sample_counts.length; i += 2) {
	var note = interlaced_notes_and_sample_counts[i];
	var sample_count = interlaced_notes_and_sample_counts[i + 1];
    sample_count_for_note[note] = sample_count;
    for (var sample_index = 0; sample_index < sample_count; sample_index++) {
	  post('enabling sample for note: ' + sample_index + ' ' + note);
      enableSampleForNote(sample_index, note);
    }
  }
}
