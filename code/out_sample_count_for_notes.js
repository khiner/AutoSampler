inlets = 1;
outlets = 1;

function bang() {
  f = new File("note_to_sample_info_map.txt", "read", "text");
  sample_count_for_notes = {}
  while (f.readline() != '_'); // skip to the map section
  while (f.position != f.eof) {
	var line = f.readline(10000);
	var note = line.substr(0, line.indexOf(':'));
	post('note: ' + note);
	var note_count = (line.match(/\|/g) || []).length + 1;
    sample_count_for_notes[note] = note_count;
  }

  var funbuff_ret = [];
  
  funbuff_ret.push(0);
  funbuff_ret.push("set");
  for (var key in sample_count_for_notes) {
	var val = sample_count_for_notes[key];
    post(key + " -> " + val);
    funbuff_ret.push(parseInt(key));
    funbuff_ret.push(parseInt(val));
  }

  //funbuff_ret = funbuff_ret.concat([46, 2, 47, 1, 50, 1]);
  post(funbuff_ret);
  outlet.apply(this, funbuff_ret);
  //outlet(0, "set", 46, 2, 47, 1, 50, 1);
}
