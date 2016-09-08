# AutoSampler

This is a Max4Live instrument (for Ableton Live) designed to be used with a custom sample-map file ([which you can generate by following these instructions](https://github.com/khiner/aubio/blob/develop/ruby/usage_instructions.md)) to analyze your audio library and find sections of audio that closely match pure pitches, so you can play samples from your library that match the notes you're playing on your MIDI keyboard!

_Note: The process of making the sample-map file is sketchy.  Eventually I'd like to move the relevant code that analyzes audio directories and creates the sample-map file into the Max4Live code, embedded in the amxd file.  This would be closer to my original vision of a true instrument that you can plug and play standalone.  Meanwhile, I'm relying on all the tools in the linked Aubio library and untangling those into a standalone set of code runnable in the Ableton environment is too big of a project for me to take on now._

## Here's what it looks like

![](/screenshot.png?raw=true)
