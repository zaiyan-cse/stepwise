;
(function($, window, document, undefined) {

  var pluginName = "stepwise",
    defaults = {
      clickInput: true,
      dataType: "string",
      delimiter: " ",
      inputElement: null,
      keyInput: true,
      keyCodesToIgnore: [9, 16, 17, 18, 20, 27, 224, 91, 93],
      outputToElement: true,
      tapInput: true,
      gamepadInput: true,
      allowInputDuringDelay: true
    };

  $.fn[pluginName] = function(config) {
    return this.each(function() {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new Stepwise(this, config));
      }
    });
  }

  $.fn[pluginName].effects = {};

  function Stepwise(element, config) {

    var okToInit = true;

    if (typeof config === 'object') {
      if (!Array.isArray(config)) {
        if (config.delimiter == 'newline') {
          config.delimiter = /\r?\n/;
        }
        this.options = $.extend({}, defaults, config);
      } else {
        this.options = $.extend({}, defaults, {});
        this.options.source = config;
        this.options.dataType = 'array';
      }
    } else if (typeof config === 'string') {
      this.options = $.extend({}, defaults, {});
      this.options.source = config;
    } else {
      okToInit = false;
    }

    if (okToInit) {
      this.element = element;
      $(this.element).bind("executeStep", this.handleExecuteStep);
      this._defaults = defaults;
      this._name = pluginName;
      this._haveGamepadEvents = 'ongamepadconnected' in window;
      this._controllers = {};
      this._pressedControllerButtons = [];
      this._isActive = true;
      this._isInputEnabled = true;
      this.init();
    }
  }

  Stepwise.prototype.init = function() {
    this.setupInput();
    this.load(this.options.source, this.options.dataType);
  };

  Stepwise.prototype.deactivate = function() {
    $(this.element).data('plugin_stepwise', null).unbind('executeStep');
    clearInterval(this._gamepadInterval);
    this._isActive = false;
  };

  Stepwise.prototype.setInputEnabled = function(enabled) {
    this._isInputEnabled = enabled;
  }

  Stepwise.prototype.setupInput = function() {
    var me = this;
    if (this.options.keyInput) {
      $("body").keydown(function(event) {
        if (me.options.keyCodesToIgnore.indexOf(event.keyCode) == -1 && me._isInputEnabled) {
          if (me._isInputEnabled) {
            me.nextStep();
          }
        }
      });
    }
    var inputElement = this.element;
    if (this.options.inputElement != null) {
      inputElement = this.options.inputElement;
    }
    if (this.options.clickInput) {
      $(inputElement).mousedown(function() {
        if (me._isInputEnabled) {
          me.nextStep();
        }
      });
    }
    if (this.options.tapInput) {
      $(inputElement).on("tap", function() {
        if (me._isInputEnabled) {
          me.nextStep();
        }
      });
    }
    if (this.options.gamepadInput) {
      var scanGamepads = function() {
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (var i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) {
            if (gamepads[i].index in me._controllers) {
              me._controllers[gamepads[i].index] = gamepads[i];
            } else {
              me.addGamepad(gamepads[i]);
            }
          }
        }
      }

      window.addEventListener("gamepadconnected", this.gamepadConnectHandler);
      window.addEventListener("gamepaddisconnected", this.gamepadDisconnectHandler);
      if (!this._haveGamepadEvents) {
        this._gamepadInterval = setInterval(scanGamepads, 500);
      }
    }
  }

  Stepwise.prototype.gamepadConnectHandler = function() {
    // nothing
  }

  Stepwise.prototype.gamepadDisconnectHandler = function(e) {
    this.removeGamepad(e.gamepad);
  }

  Stepwise.prototype.addGamepad = function(gamepad) {

    var me = this;

    function scanGamepads() {
      var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
      for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          if (gamepads[i].index in me._controllers) {
            me._controllers[gamepads[i].index] = gamepads[i];
          } else {
            me.addGamepad(gamepads[i]);
          }
        }
      }
    }

    function updateGamepadStatus() {

      if (!me._haveGamepadEvents) {
        scanGamepads();
      }

      var i = 0;
      var j;
      for (j in me._controllers) {
        var controller = me._controllers[j];
        for (i = 0; i < controller.buttons.length; i++) {
          var val = controller.buttons[i];
          var pressed = val == 1.0;
          if (typeof(val) == "object") {
            pressed = val.pressed;
            val = val.value;
          }
          if (pressed) {
            if (me._pressedControllerButtons.indexOf(i) == -1) {
              if (me._isInputEnabled) {
                me.nextStep();
              }
              me._pressedControllerButtons.push(i);
            }
          } else {
            var index = me._pressedControllerButtons.indexOf(i);
            if (index != -1) {
              me._pressedControllerButtons.splice(index, 1);
            }
          }
        }
      }

      if (me._isActive) {
        requestAnimationFrame(updateGamepadStatus);
      }
    }

    this._controllers[gamepad.index] = gamepad;
    requestAnimationFrame(updateGamepadStatus);
  }

  Stepwise.prototype.removeGamepad = function(gamepad) {
    delete this._controllers[gamepad.index];
  }

  Stepwise.prototype.load = function(source, dataType) {

    var me = this;

    switch (dataType) {

      case "array":
        source = source.join("\n");
        this.score = new Score(source, "text", this.element, this.options.delimiter);
        this.score.init();
        this.doOnLoadCallback(this);
        break;

      case "string":
        this.score = new Score(source, "text", this.element, this.options.delimiter);
        this.score.init();
        this.doOnLoadCallback(this);
        break;

      case "textfile":
        $.ajax({
          type: "GET",
          url: source,
          dataType: 'text',
          success: function(text) {
            me.score = new Score(text, "text", me.element, this.options.delimiter);
            me.score.init();
            me.doOnLoadCallback(this);
          },
          error: function(request, status, error) {
            console.log("Stepwise error on loading text file.");
          }
        });
        break;

      case "xml":
        this.score = new Score($(source), "xml", this.element);
        this.score.init();
        this.doOnLoadCallback(this);
        break;

      case "xmlfile":
        $.ajax({
          type: "GET",
          url: source,
          dataType: 'xml',
          success: function(xml) {
            me.score = new Score($(xml).find("stepwise").first(), "xml", me.element);
            me.score.init();
            me.doOnLoadCallback(this);
          },
          error: function(request, status, error) {
            switch (status) {
              case "parsererror":
                console.log("Stepwise error on load: the XML could not be parsed.");
                break;
              default:
                console.log("Stepwise error on loading XML file.");
                break;
            }
          }
        });
        break;

    }

  }

  Stepwise.prototype.doOnLoadCallback = function() {
    if (this.options.onLoad != null) {
      this.options.onLoad(this);
    }
  }

  Stepwise.prototype.reset = function() {
    this.score.reset();
  }

  Stepwise.prototype.nextStep = function() {
    return this.score.nextStep(true, this.options.allowInputDuringDelay);
  }

  Stepwise.prototype.play = function() {
    this.score.play();
  }

  Stepwise.prototype.stop = function() {
    this.score.stop();
  }

  Stepwise.prototype.handleExecuteStep = function(event, step) {

    var stepwise = $(this).data("plugin_stepwise");

    switch (step.command) {

      case "narrate":
      case "speak":
      case "think":
      case "sing":
        if (stepwise.options.outputToElement) {
          if (step.target != null) {
            if (step.target.visible) {
              stepwise.displayStepContent(step);
            }
          } else {
            stepwise.displayStepContent(step);
          }
        }
        break;

      case "reset":
        step.target.reset();
        break;

      case "sample":
        step.target.nextStep();
        break;

      case "setbackcolor":
        stepwise.score.setBackColor(step.content);
        break;

      case "setdate":
        stepwise.score.setDate(step.date);
        break;

      case "setforecolor":
        stepwise.score.setForeColor(step.content);
        break;

      case "setlocation":
        stepwise.score.setLocation(step.target);
        break;

      case "setmidcolor":
        stepwise.score.setMidColor(step.content);
        break;

      case "setsequence":
        stepwise.score.setSequence(step.target, step.atDate, step.autoStart);
        break;

      case "settemperature":
        stepwise.score.setTemperature(step.content, step.units);
        break;

      case "setweather":
        stepwise.score.setWeather(step.weather);
        break;

      case "group":
        step.executeSubsteps();
        break;

    }

    if (stepwise.options.onStep != null) {
      stepwise.options.onStep(event, step);
    }

  }

  Stepwise.prototype.displayStepContent = function(step) {
    if (!step.append) {
      $(this.element).empty();
    }
    $(this.element).append(step.content);
  }

  function Score(data, dataType, element, delimiter) {
    this.element = element;
    this.isPlaying = false;
    this.setDefaults();
    this.parseMetadata(data, dataType, delimiter);
    this.parseStory(data, dataType, delimiter);
    this.init();
  }

  Score.prototype.setDefaults = function() {

    this.version = 1;
    this.type = "basic";
    this.timeScale = 1.0;
    this.beatsPerMinute = 120;
    this.pulsesPerBeat = 4;
    this.durationPerBeat = 4;
    this.swing = 1;
    this.delayEndTime = -1;

    this.sequenceQueue = [];
    this.sequenceIndex = 0;

    this.currentLocation = new Location($("<location id=\"defaultLocation\" lat=\"0\" lon=\"0\">Default Location</location>"));

    this.currentTemperature = 24;
    this.currentTemperatureUnits = TemperatureUnits.CELSIUS;

    this.currentWeather = WeatherConditions.CLEAR;

    this.currentDate = Date.now();

    this.backColor = '#ffffff';
    this.midColor = '#888888';
    this.foreColor = '#000000';

  }

  Score.prototype.parseMetadata = function(data, dataType, delimiter) {

    var me = this;

    if (data != null) {
      if (dataType != "xml") {

        var lines = data.split(delimiter);

        var i, line, lineLower, key,
          n = lines.Length,
          isUsingStepwiseKeys = false;

        for (i = 0; i < n; i++) {

          line = lines[i];
          lineLower = line.toLowerCase();

          key = "stepwise.title:";
          if (lineLower.indexOf(key) == 0) {
            this.title = line.substr(key.length);
            isUsingStepwiseKeys = true;
          }
          key = "stepwise.credit:";
          if (lineLower.indexOf(key) == 0) {
            this.primaryCredits = line.substr(key.length);
            isUsingStepwiseKeys = true;
          }
          key = "stepwise.description:";
          if (lineLower.indexOf(key) == 0) {
            this.description = line.substr(key.length);
            isUsingStepwiseKeys = true;
          }
        }

        if (!isUsingStepwiseKeys) {
          if (lines.length > 0) {
            this.title = lines[0].trim();
          }
          if (lines.length > 1) {
            this.primaryCredits = lines[1].trim();
          }
          if (lines.length > 2) {
            this.description = lines[2].trim();
          }
        }

        if (this.title == "") {
          this.title = "Untitled";
        }
        if (this.primaryCredits == "") {
          this.primaryCredits = "Author unknown";
        }
        this.version = 1;
        this.type = "basic";

      } else {

        this.title = data.find("title").first().text();
        this.description = data.find("description").first().text();
        this.primaryCredits = data.find("primaryCredits").first().text();
        this.secondaryCredits = data.find("secondaryCredits").first().text();
        this.version = parseInt(data.find("version").first().text());
        var pulseData = data.find("pulse");
        if (pulseData.length != 0) {
          if (pulseData.first().attr("beatsperminute") != null) {
            this.beatsPerMinute = parseFloat(pulseData.first().attr("beatsperminute"));
          }
          if (pulseData.first().attr("pulsesperbeat") != null) {
            this.pulsesPerBeat = parseFloat(pulseData.first().attr("pulsesperbeat"));
          }
          if (pulseData.first().attr("durationperbeat") != null) {
            this.durationPerBeat = parseInt(pulseData.first().attr("durationperbeat"));
          }
          if (pulseData.first().attr("swing") != null) {
            this.swing = parseFloat(pulseData.first().attr("swing"));
          }
          this.pulse = ((60 * 1000) / this.beatsPerMinute) / this.pulsesPerBeat;
        }

      }
    }
  }

  Score.prototype.parseStory = function(data, dataType, delimiter) {

    var me = this;
    this.xmlData = null;

    if (data != null) {

      this.characters = [];
      this.charactersById = {};
      this.sequences = [];
      this.sequencesById = {};
      this.sequenceQueue = [];
      var sequence;

      if (dataType != "xml") {
        sequence = new Sequence(data, "text", this, delimiter);
        this.sequences.push(sequence);
        this.sequencesById[sequence.id] = sequence;

      } else {
        this.xmlData = data;
        data.find("sequence").each(function() {
          sequence = new Sequence($(this), "xml", me);
          if (sequence.id == null) {
            sequence.id = "sequence" + me.sequences.length;
          }
          me.sequences.push(sequence);
          me.sequencesById[sequence.id] = sequence;
        });

        this.sequenceIndex = 0;
        this.currentSequence = null;

        var character;
        data.find("character").each(function() {
          character = new Character($(this), me);
          if (character.id == null) {
            character.id = "character" + me.characters.length;
          }
          me.characters.push(character);
          me.charactersById[character.id] = character;
        });

        this.locations = [];
        this.locationsById = {};
        var location;
        data.find("location").each(function() {
          location = new Location($(this), me);
          if (location.id == null) {
            location.id = "location" + me.locations.length;
          }
          me.locations.push(location);
          me.locationsById[location.id] = location;
        });
      }
    }

  }

  Score.prototype.init = function() {

    var i,
      n = this.sequences.length;

    for (i = 0; i < n; i++) {
      this.sequences[i].init();
    }
  }

  Score.prototype.reset = function() {

    var i,
      n = this.sequences.Length;

    for (i = 0; i < n; i++) {
      this.sequences[i].reset();
    }

    this.sequenceIndex = 0;
    this.currentSequence = null;
    this.sequenceQueue = [];
  }

  Score.prototype.nextStep = function(setTriggerTime, allowInputDuringDelay) {
    var currentTime = new Date().getTime();
    if (allowInputDuringDelay || (!allowInputDuringDelay && currentTime >= this.delayEndTime)) {
      var step = null;

      if (setTriggerTime == null) {
        setTriggerTime = false;
      }

      if (setTriggerTime) {
        this.triggerTime = currentTime;
      }

      this.updateCurrentSequence();

      // if the sequence hasn't been exhausted, execute its next step
      if (!this.currentSequence.isExhausted) {
        step = this.currentSequence.nextStep();
      }

      var me = this;
      if (this.isPlaying) {
        this.timeout = setTimeout(function() {
          me.nextStep();
        }, (this.pulse * this.swing * (1.0 / (this.timeScale + .0001))));
      }

      return step;
    } else {
      return null;
    }
  }

  Score.prototype.play = function() {
    this.isPlaying = true;
    this.nextStep();
  }

  Score.prototype.stop = function() {
    this.isPlaying = false;
    clearTimeout(this.timeout);
  }

  Score.prototype.updateCurrentSequence = function() {

    var sequence;

    // if there are sequences in the queue, get the current one
    if (this.sequenceQueue.length > 0) {
      sequence = this.sequenceQueue[this.sequenceQueue.length - 1];

      // if it's already completed, then
      if (sequence.isCompleted) {

        // remove it from the queue
        if (this.sequenceQueue.length > 0) {
          this.sequenceQueue.pop();
        }

        // if there's still a queue, then grab the next sequence from it
        if (this.sequenceQueue.length > 0) {
          sequence = this.sequenceQueue[this.sequenceQueue.length - 1];

          // otherwise, grab the current non-queue sequence
        } else {
          sequence = this.sequences[this.sequenceIndex];
        }
      }

      // grab the current non-queue sequence
    } else {
      sequence = this.sequences[this.sequenceIndex];
    }

    // if the sequence hasn't been exhausted, make it current
    if (!sequence.isExhausted) {
      this.currentSequence = sequence;
    }

  }

  Score.prototype.trackDelay = function(millisecondDelay) {
    var currentTime = new Date().getTime();
    this.delayEndTime = Math.max(this.delayEndTime, currentTime + millisecondDelay);
  }

  /**
   * Given a sequence id, makes it the current sequence.
   *
   * @param sequence		Id of the sequence to make current.
   * @param atDate		If specified, will attempt to cue up the sequence to the same date.
   * @param autoStart		If true, the sequence will automatically play its first step.
   */
  Score.prototype.setSequence = function(sequence, atDate, autoStart) {

    var index = this.sequences.indexOf(sequence);
    if (index != -1) {
      this.sequenceIndex = index;
      this.currentSequence = sequence;
      if (atDate != null) {
        this.currentSequence.matchDate(atDate);
      }
      if (autoStart) {
        this.currentSequence.nextStep();
      }
    }

  }

  Score.prototype.playSequence = function(sequence) {
    this.currentSequence = sequence;
    this.sequenceQueue.push(sequence);
    sequence.nextStep();
  }

  /**
   * Given an id and a type, returns the corresponding object.
   *
   * @param	type	The type of item to be retrieved.
   * @param	id		The id of the sequence to be retrieved.
   */
  Score.prototype.getItemForId = function(type, id) {

    switch (type) {

      case "character":
        return this.charactersById[id];
        break;

      case "location":
        return this.locationsById[id];
        break;

      case "sequence":
        return this.sequencesById[id];
        break;

    }

    return null;
  }

  Score.prototype.setBackColor = function(color) {
    this.backColor = color;
  }

  Score.prototype.setForeColor = function(color) {
    this.foreColor = color;
  }

  Score.prototype.setMidColor = function(color) {
    this.midColor = color;
  }

  Score.prototype.setLocation = function(location) {

    var index = this.locations.indexOf(location);
    if (index != -1) {
      this.currentLocation = location;
    }

  }

  Score.prototype.setTemperature = function(temperature, units) {
    this.currentTemperature = temperature;
    this.currentTemperatureUnits = units;
  }

  Score.prototype.setWeather = function(weather) {
    this.currentWeather = weather;
  }

  Score.prototype.setDate = function(date) {
    this.currentDate = date;
  }

  function Sequence(data, dataType, score, delimiter) {

    var me = this;

    this.parentScore = score;
    this.shuffle = false;
    this.repeat = false;
    this.count = -1;
    this.steps = [];
    this.stepIndex = -1;
    this.isCompleted = false;
    this.isExhausted = false;
    this.completions = 0;
    this.usedIndexes = [];
    this.percentCompleted = 0;

    if (dataType != "xml") {
      if (this.parentScore.sequences != null) {
        this.id = "sequence" + this.parentScore.sequences.Length;
      } else {
        this.id = "sequence0";
      }
      this.repeat = true;

      var lines = data.split(delimiter);

      var i, line, lineLower, step,
        n = lines.length;

      for (i = 0; i < n; i++) {
        line = lines[i];
        lineLower = line.toLowerCase();
        if ((lineLower.indexOf("stepwise.title:") != 0) && (lineLower.indexOf("stepwise.credit:") != 0) && (lineLower.indexOf("stepwise.description:") != 0)) {
          step = new Step(line, "text", this.parentScore);
          this.steps.push(step);
        }
      }

    } else {

      this.id = $(data).attr("id");
      if (this.id == null) {
        this.id = "sequence" + this.parentScore.sequences.Length;
      }
      this.shuffle = $(data).attr("shuffle") == "true" ? true : false;
      if ($(data).attr("repeat") != null) {
        this.repeat = ($(data).attr("repeat") != null);
        this.count = parseInt($(data).attr("repeat"));
        if (isNaN(this.count)) {
          this.count = -1; // repeat infinitely
        }
      }
      this.grouping = $(data).attr("grouping");

      var step;
      // construct groupings
      if (this.grouping != null) {
        var stepData, groupingInstruction,
          stepIndex = 0,
          groupingStepIndex = 0,
          groupedData = $('<data/>'),
          group = $('<group/>'),
          steps = data.children(),
          stepCount = steps.length;
        while (stepIndex < stepCount) {
          groupingInstruction = this.grouping[groupingStepIndex].toLowerCase();
          switch (groupingInstruction) {
            case 'x':
            case '&':
              stepData = steps.eq(stepIndex).clone();
              if (groupingStepIndex > 0) {
                stepData.attr('delay', groupingStepIndex);
              }
              if (groupingInstruction == '&') {
                stepData.attr('append', 'true');
                stepData.children().attr('append', 'true');
              }
              group.append(stepData);
              stepIndex++;
              break;
          }
          groupingStepIndex++;
          if ((groupingStepIndex == this.grouping.length) || (stepIndex == stepCount)) {
            groupingStepIndex = 0;
            groupedData.append(group);
            group = $('<group/>');
          }
        }
        groupedData.children().each(function() {
          step = new Step($(this), "xml", me.parentScore);
          me.steps.push(step);
        });

      } else {
        data.children().each(function() {
          step = new Step($(this), "xml", me.parentScore);
          me.steps.push(step);
        });
      }
    }

  }

  Sequence.prototype.init = function() {

    var i,
      n = this.steps.length;

    for (i = 0; i < n; i++) {
      this.steps[i].init();
    }

  }

  Sequence.prototype.reset = function() {
    this.stepIndex = -1;
    this.isCompleted = false;
    this.isExhausted = false;
    this.percentCompleted = 0;
  }

  Sequence.prototype.seekToStep = function(step) {
    var index = this.steps.indexOf(step);
    if (index == -1) {
      var n = this.steps.length;
      var subIndex;
      for (var i=0; i<n; i++) {
        subIndex = this.steps[i].substeps.indexOf(step);
        if (subIndex != -1) {
          this.stepIndex = index - 1;
        }
      }
    } else {
      this.stepIndex = index - 1;
    }
    if (index == -1) {
      console.log('Could not cue up step in sequence “'+this.id+'”; not found.');
    }
  }

  Sequence.prototype.nextStep = function() {

    var result = null;

    //console.log(this.id + ' ' + this.isExhausted + ' ' + this.shuffle + ' ' + this.isCompleted);

    if (this.steps.length > 0) {

      // if the sequence hasn't been exhausted, then
      if (!this.isExhausted) {

        // if the sequence is not shuffled, then
        if (!this.shuffle) {

          // if the sequence has been completed and is set to repeat, then restart it
          if (this.isCompleted && this.repeat) {
            //console.log('sequence was completed; resetting');
            this.reset();
          }

          this.stepIndex++;
          result = this.steps[this.stepIndex].execute();

          this.percentCompleted = this.stepIndex / parseFloat(this.steps.Count);

          //console.log("step " + this.stepIndex);

          // if this is the last step in the sequence, then
          if (this.stepIndex >= (this.steps.length - 1)) {
            this.completions++;

            //console.log('sequence ' + this.id + ' reached its end');

            // if the sequence is set to repeat, then
            if (this.repeat) {
              //console.log('this is a repeating sequence');

              if (this.count > -1) {
                //console.log('a count has been specified');
                if (this.completions >= this.count) {
                  //console.log('the count has been exhausted');
                  this.isExhausted = true;
                } else {
                  //console.log('resetting for another round');
                  this.reset();
                }
              } else {
                //console.log('no count specified; resetting for another round');
                this.reset();
              }

              // otherwise, if the sequence is not set to repeat, then mark it as completed
            } else {
              //console.log('this is a non-repeating sequence');

              if (this.count > -1) {
                //console.log('a count has been specified');
                if (this.completions >= this.count) {
                  //console.log('the count has been exhausted');
                  this.isExhausted = true;
                } else {
                  //console.log('the sequence is completed');
                  this.isCompleted = true;
                }
              } else {
                //console.log('no count specified; sequence is completed');
                this.isCompleted = true;
                this.isExhausted = true;
              }
            }
          }

          // shuffled playback
        } else {
          //console.log('this is a shuffled sequence');
          do {
            this.stepIndex = Math.floor(Math.random() * this.steps.length);
          } while (this.usedIndexes.indexOf(this.stepIndex) != -1);
          this.usedIndexes.push(this.stepIndex);
          if (this.usedIndexes.length >= this.steps.length) {
            //console.log('used up all of the steps; starting over');
            this.usedIndexes = [];
          }
          this.completions++;
          this.isCompleted = true;
          if ((this.count != -1) && (this.completions >= this.count)) {
            //console.log('the count has been exhausted');
            this.isExhausted = true;
          }
          result = this.steps[this.stepIndex].execute();
        }
      }
    }

    return result;
  }

  Sequence.prototype.getCurrentStepId = function() {
    if (this.stepIndex == -1) {
      return "";
    } else {
      return this.steps[this.stepIndex].id;
    }
    return "";
  }

  Sequence.prototype.matchDate = function(date) {

    var i, step,
      n = this.steps.length;

    if (date == null) {
      date = this.parentScore.currentDate;
    }

    for (i = 0; i < n; i++) {
      step = this.steps[i];
      if (step.command == "setdate") {
        if (date.getTime() === step.date.getTime()) {
          this.stepIndex = i;
          break;
        }
      }
    }
  }

  var SpeechTone = {
    NORMAL: "normal",
    MURMUR: "murmur",
    WHISPER: "whisper",
    SHOUT: "shout",
    SCREAM: "scream"
  }

  var TemperatureUnits = {
    FAHRENHEIT: "fahrenheit",
    CELSIUS: "celsius"
  }

  // adapted from http://openweathermap.org/weather-conditions
  var WeatherConditions = {
    CLEAR: "clear",
    DRIZZLE: "drizzle",
    LIGHTRAIN: "lightrain",
    RAIN: "rain",
    HEAVYRAIN: "heavyrain",
    THUNDERSTORM: "thunderstorm",
    SNOW: "snow",
    ATMOSPHERE: "atmosphere",
    CLOUDS: "clouds",
    EXTREME: "extreme",
    ADDITIONAL: "additional"
  }

  function Step(data, dataType, score) {

    var me = this;
    this.parentScore = score;

    if (dataType != "xml") {
      this.command = "narrate";
      this.content = data;
      this.tone = SpeechTone.NORMAL;
      this.delay = 0;
      this.substeps = [];
      this.type = null;

    } else {

      this.data = $(data);
      this.command = data.prop("tagName").toLowerCase();
      this.itemRef = data.attr("itemRef");
      this.append = (data.attr("append") == "true") ? true : false;
      if (data.attr("delay") != null) {
        this.delay = parseFloat(data.attr("delay"));
      }
      this.type = data.attr("type");

      this.content = data.text();
      this.substeps = [];

      var step;
      data.children().each(function() {
        var step = new Step($(this), "xml", me.parentScore);
        me.substeps.push(step);
      });

    }

    this.parseCommand();

  }

  Step.prototype.parseCommand = function() {

    switch (this.command) {

      case "speak":
      case "sing":
        this.tone = SpeechTone[this.data.attr("tone") != null ? this.data.attr("tone").toUpperCase() : SpeechTone.NORMAL];
        break;

      case "settemperature":
        this.units = TemperatureUnits[this.data.attr("units") != null ? this.data.attr("units").toUpperCase() : TemperatureUnits.CELSIUS];
        break;

      case "setweather":
        this.weather = WeatherConditions[this.content != null ? this.content.toUpperCase() : WeatherConditions.CLEAR];
        break;

      case "setdate":
      case "settime":
        this.date = new Date(this.content);
        break;

      case "setsequence":
        this.atDate = this.data.attr("atDate");
        this.autoStart = this.data.attr("autoStart") == "true" ? true : false;
        break;

    }

  }

  Step.prototype.init = function(substep) {

    var i, n;

    if (substep == null) {
      substep = false;
    }

    switch (this.command) {

      case "narrate":
        this.target = {
          visible: true
        };
        break;

      case "speak":
      case "think":
      case "sing":
        this.target = this.parentScore.getItemForId("character", this.data.attr("character"));
        this.target.setVisibilityForStep(this);
        break;

      case "setlocation":
        this.target = this.parentScore.getItemForId("location", this.content);
        break;

      case "setsequence":
      case "sample":
      case "reset":
        this.target = this.parentScore.getItemForId("sequence", this.content);
        break;

      case "option":
        this.target = this.parentScore.getItemForId("character", this.data.attr("character"));
        switch (this.type) {

          case "sequence":
            this.destination = this.parentScore.getItemForId("sequence", this.data.attr("destination"));
            break;

          case "url":
            this.destination = this.data.attr("destination");
            break;

        }
        break;

      default:
        if (this.data.attr("character") != null) {
          this.target = this.parentScore.getItemForId("character", this.data.attr("character"));
        } else {
          this.target = {
            visible: false
          };
        }
        break;

    }

    n = this.substeps.length;
    for (i = 0; i < n; i++) {
      this.substeps[i].init(true);
    }

  }

  Step.prototype.execute = function() {
    var me = this;
    if (this.delay == null) {
      $(this.parentScore.element).trigger("executeStep", this);
    } else {
      var millisecondDelay = me.delay * me.parentScore.pulse * (1.0 / (me.parentScore.timeScale + .0001));
      setTimeout(function() {
        $(me.parentScore.element).trigger("executeStep", me);
      }, millisecondDelay);
      me.parentScore.trackDelay(millisecondDelay);
    }
    return this;
  }

  Step.prototype.executeSubsteps = function() {
    var i, step,
      n = this.substeps.length;
    for (i = 0; i < n; i++) {
      step = this.substeps[i];
      step.execute();
    }
  }

  function Character(data, score) {
    this.data = $(data);
    this.parentScore = score;
    this.id = data.attr("id");
    this.firstName = data.attr("firstname");
    this.lastName = data.attr("lastname");
    this.fullName = this.firstName + (((this.lastName == "") || (this.lastName == null)) ? "" : " " + this.lastName);
    this.visible = (data.attr("visible") == "true") ? true : false;
  }

  Character.prototype.setVisibilityForStep = function(step) {
    if (this.data.attr("visible") != "false") {
      switch (step.command) {
        case "speak":
        case "think":
        case "sing":
        case "option":
          this.visible = true;
          break;
      }
    }
  }

  function Location(data, score) {
    this.data = $(data);
    this.parentScore = score;
    this.id = data.attr("id");
    this.latitude = parseFloat(data.attr("lat"));
    this.longitude = parseFloat(data.attr("lon"));
    this.name = data.text();
  }

  function Agent() {
    this.panel = new Panel();
    this.typography = new Typography();
    this.media = new Media();
    this.camera = new Camera();
    this.avatar = new Avatar();
    this.instrument = new Instrument();
  }

  function Panel() {
    this.transition = .5;
    this.easing = "none";
    this.left = 0;
    this.top = 0;
    this.width = 0;
    this.height = 0;
    this.margin = 0;
    this.borderWidth = 0;
    this.borderColor = "#fff";
    this.matteColor = "#ffffff00";
  }

  function Typography() {
    this.color = "#ffffff";
    this.transition = .5;
    this.easing = "none";
    this.font = "Helvetica";
    this.fontSize = -1;
    this.letterSpacing = "100%";
    this.lineHeight = "100%";
    this.align = "left";
    this.transform = "uppercase";
    this.margin = 0;
    this.backgroundColor = "#fff";
    this.padding = 0;
  }

  function Media() {
    this.url = "";
  }

  function Camera() {
    this.position = "0,0,0";
    this.rotation = "0,0,0";
    this.focalLength = 60;
    this.lookAt = null;
    this.transition = .5;
    this.easing = "none";
  }

  function Avatar() {
    this.firstName = "";
    this.lastName = "";
    this.fullName = "";
    this.biography = "";
    this.media = null;
    this.model = null;
    this.birthdate = null;
  }

  function Instrument() {
    this.name = "";
  }

})(jQuery, window, document);


(function($) {

  var extensionMethods = {

    AbstractEffect: AbstractEffect

  };

  $.extend(true, $.fn.stepwise.effects, extensionMethods);

  function AbstractEffect(instance, options) {
    if (instance != null) {
      this.bindToInstance(instance);
    }
    this.options = {
      useCharacterNames: true,
      createBreakTags: true,
      includeTemporal: true,
      includeEnvironmental: true,
      includeGeographic: true,
      ignoreFilenames: true
    };
    $.extend(this.options, options);
    this.bindings = [];
    this.displayStepHandlers = [];
    this.fileExtensions = ['gif', 'jpg', 'jpeg', 'png', 'mp3', 'wav', 'ogg', 'mp4', 'm4a', 'm4v', 'obj'];
    this.lastCharacter = null;
  }

  AbstractEffect.prototype.bindings = null;

  AbstractEffect.prototype.bindToInstance = function(stepwiseInstance) {
    var me = this;
    this.instance = stepwiseInstance;
    this.visibleCharacterCount = this.getVisibleCharacterCount();
    $(this.instance.element).bind("executeStep", function(event, step) {
      var i;
      var bindings = me.eligibleBindingsForStep(step);
      var n = bindings.length;
      for (i = 0; i < n; i++) {
        switch (step.command) {

          case "speak":
          case "narrate":
          case "think":
            if ((!me.options.ignoreFilenames || (me.options.ignoreFilenames && !me.hasMediaFileExtension(step.content))) && me.getIdFromYouTubeURL(step.content) == null) {
              me.displayStep(step, bindings[i].element, me.parseCharacterAction(step));
            }
            break;

          case "option":
            var element = $('<a class="option" href="javascript:;">' + step.content + '</a>');
            element.data("step", step);
            element.click(function() {
              var step = $(this).data("step");
              if (step.type == "sequence") {
                step.parentScore.triggerTime = new Date().getTime()
                this.instance.score.setSequence(step.destination, step.atDate, step.autoStart);
              }
            });
            me.displayStep(step, bindings[i].element, element);
            break;

          case "setbackcolor":
          case "setmidcolor":
          case "setforecolor":
            me.displayStep(step, bindings[i].element, null);
            break;

          case "setlocation":
            if (me.options.includeGeographic) {
              me.displayStep(step, bindings[i].element, '<br />' + step.target.name);
            }
            break;

          case "settemperature":
            if (me.options.includeEnvironmental) {
              me.displayStep(step, bindings[i].element, '<br />' + me.parseTemperature(step));
            }
            break;

          case "setweather":
            // do nothing
            break;

          case "setdate":
            if (me.options.includeTemporal) {
              me.displayStep(step, bindings[i].element, '<br />' + step.date.toDateString());
            }
            break;

          case "settime":
            if (me.options.includeTemporal) {
              me.displayStep(step, bindings[i].element, '<br />' + step.date.toLocaleTimeString());
            }
            break;

        }
      }

    });
  }

  AbstractEffect.prototype.basename = function(path, suffix) {
    var b = path.replace(/^.*[\/\\]/g, '');
    if ((typeof(suffix) == 'string') && (b.substr(b.length - suffix.length) == suffix)) {
      b = b.substr(0, b.length - suffix.length);
    }
    return b;
  }

  AbstractEffect.prototype.hasMediaFileExtension = function(str) {
    var array = str.split('?');
    str = array[0];
    array = str.split('#');
    str = array[0]
    var b = this.basename(str);
    if (b.indexOf('.') == -1) {
      return false;
    }
    var temp = b.split('.');
    var ext = temp[temp.length - 1];
    if (ext == parseFloat(ext)) {
      return false;
    }
    if (ext.charAt(ext.length - 1) == '#') {
      ext = ext.substr(0, ext.length - 1);
    }
    return (this.fileExtensions.indexOf(ext.toLowerCase()) != -1);
  }

  AbstractEffect.prototype.getIdFromYouTubeURL = function(url) {
    var id;
    url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    if (url[2] != null) {
      id = url[2].split(/[^0-9a-z_-]/i);
      id = id[0];
      return id;
    } else {
      return null;
    }
  }

  AbstractEffect.prototype.getVisibleCharacterCount = function() {
    var count = 0;
    var i, n = this.instance.score.characters.length;
    for (i = 0; i < n; i++) {
      if (this.instance.score.characters[i].visible) {
        count++;
      }
    }
    return count;
  }

  AbstractEffect.prototype.getVisibleCharacters = function() {
    var character,
      characters = []
    var i, n = this.instance.score.characters.length;
    for (i = 0; i < n; i++) {
      character = this.instance.score.characters[i];
      if (character.visible) {
        characters.push(character);
      }
    }
    return characters;
  }

  AbstractEffect.prototype.parseCharacterAction = function(step) {
    var text = step.content;
    if (this.options.useCharacterNames && (this.visibleCharacterCount > 1)) {
      var currentCharacter = step.target;
      if (currentCharacter.visible && (text.trim() != '')) {
        var isNewCharacter = (currentCharacter != this.lastCharacter);
        if (isNewCharacter) {
          switch (step.command) {

            case 'speak':
            case 'narrate':
              text = '<br />' + currentCharacter.fullName.toUpperCase() + ": " + text;
              break;

            case 'think':
              text = '<br />' + currentCharacter.fullName.toUpperCase() + ": [" + text + "]";
              break;

          }
          this.lastCharacter = currentCharacter;
        }
      } else {
        return null;
      }
    }
    if (this.options.createBreakTags) {
      text = text.replace(/(?:\\r\\n|\\r|\\n)/g, '<br />');
    }
    return text;
  }

  AbstractEffect.prototype.parseTemperature = function(step) {
    var text = step.content + "°";
    switch (step.units) {

      case this.instance.TemperatureUnits.CELSIUS:
        text = '<br />' + text + "C";
        break;

      case this.instance.TemperatureUnits.FAHRENHEIT:
        text = '<br />' + text + "F";
        break;

    }
    return text;
  }

  AbstractEffect.prototype.bindToElement = function(element) {
    this.bindings.push({
      character: "*",
      element: element
    });
  }

  AbstractEffect.prototype.removeAllBindings = function() {
    this.bindings = [];
  }

  AbstractEffect.prototype.bindCharacterToElement = function(characterId, element) {
    var character = this.instance.score.charactersById[characterId];
    if (character != null) {
      this.bindings.push({
        character: character,
        element: $(element)
      });
    }
  }

  AbstractEffect.prototype.unbindFromElement = function(element) {
    var i,
      n = this.bindings.length;
    for (i = (n - 1); i >= 0; i--) {
      if (this.bindings[i].element == element) {
        this.bindings.splice(i, 1);
      }
    }
  }

  AbstractEffect.prototype.unbindCharacterFromElement = function(characterId, element) {
    var i, binding,
      n = this.bindings.length,
      character = this.instance.score.charactersById[characterId];
    if (character != null) {
      for (i = (n - 1); i >= 0; i--) {
        binding = this.bindings[i];
        if ((binding.character == character) && (binding.element == element)) {
          this.bindings.splice(i, 1);
        }
      }
    }
  }

  AbstractEffect.prototype.eligibleBindingsForStep = function(step) {
    var i, binding, characterMatch,
      eligibleBindings = [],
      n = this.bindings.length;
    for (i = (n - 1); i >= 0; i--) {
      binding = this.bindings[i];
      characterMatch = false;
      if (binding.character == "*") {
        characterMatch = true;
      } else if ((step.target.id == null) && (binding.character == null)) {
        characterMatch = true;
      } else if ((step.target.id != null) && (binding.character != null) && (step.target.id == binding.character.id)) {
        characterMatch = true;
      }
      if (characterMatch) {
        eligibleBindings.push(binding);
      }
    }
    if (eligibleBindings.length == 0) {
      eligibleBindings.push({});
    }
    return eligibleBindings;
  }

  AbstractEffect.prototype.addDisplayStepListener = function(handler) {
    this.displayStepHandlers.push(handler);
  }

  AbstractEffect.prototype.removeDisplayStepListener = function(handler) {
    var index = this.displayStepHandlers.indexOf(handler);
    if (index != -1) {
      this.displayStepHandlers.splice(index, 1);
    }
  }

  AbstractEffect.prototype.callDisplayStepHandlers = function(step, element) {
    var i, n = this.displayStepHandlers.length;
    for (i = 0; i < n; i++) {
      this.displayStepHandlers[i](step, element);
    }
  }

  AbstractEffect.prototype.displayStep = function(step, element, processedContent) {
    var okToDisplay = true;
    if (step.target != null) {
      okToDisplay = step.target.visible;
    }
    if (processedContent == null) {
      okToDisplay = false;
    }
    if (okToDisplay) {
      if (!step.append) {
        $(element).empty();
      }
      $(element).append(processedContent);
      this.callDisplayStepHandlers(step, element);
    }
  }

})(jQuery);
