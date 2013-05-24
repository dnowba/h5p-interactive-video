var H5P = H5P || {};

/**
 * Interactive Video module
 *
 * @param {jQuery} $
 */
H5P.InteractiveVideo = (function ($) {

  /**
   * Initialize a new interactive video.
   *
   * @param {Array} params
   * @param {int} id
   * @returns {_L2.C}
   */
  function C(params, id) {
    this.params = params.interactiveVideo;
    this.contentPath = H5P.getContentPath(id);

    this.visibleInteractions = [];

    this.l10n = {
      play: 'Play',
      pause: 'Pause',
      mute: 'Mute',
      unmute: 'Unmute',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen'
    };

    this.fontSize = 16; // How large the interactions should be in px.
  };

  /**
   * Attach interactive video to DOM element.
   *
   * @param {jQuery} $container
   * @returns {undefined}
   */
  C.prototype.attach = function ($container) {
    var that = this;
    this.$container = $container;

    $container.addClass('h5p-interactive-video').html('<div class="h5p-video-wrapper"></div><div class="h5p-controls"></div><div class="h5p-dialog-wrapper h5p-hidden"><div class="h5p-dialog"></div><a href="#" class="h5p-dialog-hide">&#xf00d;</a></div>');

    // Video with interactions
    this.$videoWrapper = $container.children('.h5p-video-wrapper');
    this.attachVideo(this.$videoWrapper);

    // Controls
    this.$controls = $container.children('.h5p-controls');
    this.attachControls(this.$controls);

    // Dialog
    this.$dialogWrapper = $container.children('.h5p-dialog-wrapper');
    this.$dialog = this.$dialogWrapper.children('.h5p-dialog');
    this.$dialogWrapper.children('.h5p-dialog-hide').click(function () {
      that.$dialogWrapper.addClass('h5p-hidden');
      setTimeout(function () {
        that.$dialogWrapper.hide();
      }, 201);
      if (that.playing) {
        that.play(true);
      }
      return false;
    });
  };

  /**
   * Attach the video to the given wrapper.
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachVideo = function ($wrapper) {
    var that = this;

    this.video = new H5P.Video({
      files: this.params.video,
      controls: false,
      autoplay: false,
      fitToWrapper: false
    }, this.contentPath);

    this.video.endedCallback = function () {
      that.ended();
    };
    this.video.loadedCallback = function () {
      if (that.video.flowplayer !== undefined) {
        that.video.flowplayer.getPlugin('play').hide();
      }

      that.resizeEvent = function() {
        that.resize();
      };
      H5P.$window.resize(that.resizeEvent);
      that.resize();

      var duration = that.video.getDuration();
      that.controls.$totalTime.html(C.humanizeTime(duration));
      that.controls.$slider.slider('option', 'max', duration);
    };

    this.video.attach($wrapper);
    this.$overlay = $('<div class="h5p-overlay"></div>').appendTo($wrapper);
  };

  /**
   * Unbind event listeners.
   *
   * @returns {undefined}
   */
  C.prototype.remove = function () {
    if (this.resizeEvent !== undefined) {
      H5P.$window.unbind('resize', this.resizeEvent);
    }
  };

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div></div></div>');
    this.controls = {};

    // Play/pause button
    this.controls.$play = $wrapper.find('.h5p-play').click(function () {
      if (that.controls.$play.hasClass('h5p-pause')) {
        that.play();
      }
      else {
        that.pause();
      }
      return false;
    });

    // Fullscreen button
    this.controls.$fullscreen = $wrapper.find('.h5p-fullscreen').click(function () {
      if (that.controls.$fullscreen.hasClass('h5p-exit')) {
        that.controls.$fullscreen.removeClass('h5p-exit').attr('title', that.l10n.fullscreen);
        if (H5P.fullScreenBrowserPrefix === undefined) {
          that.$container.children('.h5p-disable-fullscreen').click();
        }
        else {
          if (H5P.fullScreenBrowserPrefix === '') {
            document.exitFullScreen();
          }
          else {
            document[H5P.fullScreenBrowserPrefix + 'CancelFullScreen']();
          }
        }
      }
      else {
        that.controls.$fullscreen.addClass('h5p-exit').attr('title', that.l10n.exitFullscreen);
        H5P.fullScreen(that.$container, that);
        if (H5P.fullScreenBrowserPrefix === undefined) {
          that.$container.children('.h5p-disable-fullscreen').hide();
        }
      }
      return false;
    });

    // Volume/mute button
    if (navigator.userAgent.indexOf('Android') === -1 && navigator.userAgent.indexOf('iPad') === -1) {
      this.controls.$volume = $wrapper.find('.h5p-volume').click(function () {
        if (that.controls.$volume.hasClass('h5p-muted')) {
          that.controls.$volume.removeClass('h5p-muted').attr('title', that.l10n.mute);
          that.video.unmute();
        }
        else {
          that.controls.$volume.addClass('h5p-muted').attr('title', that.l10n.unmute);
          that.video.mute();
        }
        return false;
      });
    }
    else {
      $wrapper.find('.h5p-volume').remove();
    }

    // Timer
    var $time = $wrapper.find('.h5p-time');
    this.controls.$currentTime = $time.children('.h5p-current');
    this.controls.$totalTime = $time.children('.h5p-total');

    // Timeline
    var $slider = $wrapper.find('.h5p-slider');
    this.controls.$slider = $slider.children().slider({
      value: 0,
      step: 0.01,
      orientation: 'horizontal',
			range: 'min',
      max: 0,
      start: function () {
        if (that.playing === undefined) {
          if (that.controls.$slider.slider('option', 'max') !== 0) {
            that.playing = false;
          }
        }
        else if (that.playing) {
          that.pause(true);
        }
      },
      slide: function (e, ui) {
        // Update timer
        that.controls.$currentTime.html(C.humanizeTime(ui.value));
      },
      stop: function (e, ui) {
        that.video.seek(ui.value);
        if (that.playing !== undefined && that.playing) {
          that.play(true);
        }
        else {
          that.toggleInteractions(Math.floor(ui.value));
        }
        if (that.hasEnded !== undefined && that.hasEnded) {
          that.hasEnded = false;
        }
      }
    });

    // Set correct margins for timeline
    $slider.css({
      marginLeft: $wrapper.children('.h5p-controls-left').width(),
      marginRight: $wrapper.children('.h5p-controls-right').width()
    });
  };

  /**
   * Resize the video to fit the wrapper.
   *
   * @param {Boolean} fullScreen
   * @returns {undefined}
   */
  C.prototype.resize = function (fullScreen) {
    var fullscreenOn = H5P.$body.hasClass('h5p-fullscreen') || H5P.$body.hasClass('h5p-semi-fullscreen');

    this.$videoWrapper.css({
      marginTop: '',
      marginLeft: '',
      width: '',
      height: ''
    });
    this.video.resize();

    if (this.videoHeight === undefined) {
      // Set default height
      var videoHeight = this.videoHeight = this.$videoWrapper.height();
    }
    else {
      var videoHeight = this.$videoWrapper.height();

      // Calculate new font size.
      this.$container.css('fontSize', (this.fontSize * (videoHeight / this.videoHeight)) + 'px');
    }

    if (!fullscreenOn) {
      if (this.controls.$fullscreen.hasClass('h5p-exit')) {
        // Update icon if we some how got out of fullscreen.
        this.controls.$fullscreen.removeClass('h5p-exit').attr('title', this.l10n.fullscreen);
      }
      return;
    }

    var controlsHeight = this.$controls.height();
    var containerHeight = this.$container.height();

    if (videoHeight + controlsHeight <= containerHeight) {
      this.$videoWrapper.css('marginTop', (containerHeight - controlsHeight - videoHeight) / 2);
    }
    else {
      var $video = this.$videoWrapper.find('.h5p-video, .h5p-video-flash > object');
      var ratio = this.$videoWrapper.width() / videoHeight;

      var height = containerHeight - controlsHeight;
      var width = height * ratio;
      $video.css('height', height);
      this.$videoWrapper.css({
        marginLeft: (this.$container.width() - width) / 2,
        width: width,
        height: height
      });
    }
  };

  /**
   * Start the show.
   *
   * @param {Boolean} seeking
   * @returns {undefined}
   */
  C.prototype.play = function (seeking) {
    var that = this;

    if (seeking === undefined) {
      this.playing = true;

      if (this.hasEnded !== undefined && this.hasEnded) {
        // Start video over again
        this.video.seek(0);
        this.hasEnded = false;
      }

      this.controls.$play.removeClass('h5p-pause').attr('title', this.l10n.pause);
    }

    // Start video
    this.video.play();

    // Set interval that updates our UI as the video clip plays.
    var lastSecond;
    this.uiUpdater = setInterval(function () {
      var time = that.video.getTime();
      that.controls.$slider.slider('option', 'value', time);

      var second = Math.floor(time);
      if (lastSecond !== second) {
        that.toggleInteractions(second);

        if (that.editor !== undefined && that.editor.dnb.dnd.$coordinates !== undefined) {
          // Remove coordinates picker while playing
          that.editor.dnb.dnd.$coordinates.remove();
          delete that.editor.dnb.dnd.$coordinates;
        }

        // Update timer
        that.controls.$currentTime.html(C.humanizeTime(second));
      }
      lastSecond = second;
    }, 40); // 25 FPS
  };

  /**
   * Pause our interactive video.
   *
   * @param {Boolean} seeking
   * @returns {undefined}
   */
  C.prototype.pause = function (seeking) {
    if (seeking === undefined) {
      this.controls.$play.addClass('h5p-pause').attr('title', this.l10n.play);
      this.playing = false;
    }

    this.video.pause();
    clearInterval(this.uiUpdater);
  };

  /**
   * Interactive video has ended.
   */
  C.prototype.ended = function () {
    this.controls.$play.addClass('h5p-pause').attr('title', this.l10n.play);
    this.playing = false;
    this.hasEnded = true;

    this.video.pause();
    clearInterval(this.uiUpdater);
  };

  /**
   * Display and remove interactions for the given second.
   *
   * @param {int} second
   */
  C.prototype.toggleInteractions = function (second) {
    for (var i = 0; i < this.params.interactions.length; i++) {
      this.toggleInteraction(i, second);
    }
  };

  /**
   * Display or remove an interaction on the video.
   *
   * @param {int} i Interaction index in params.
   * @param {int} second Optional. Current video time second.
   * @returns {unresolved}
   */
  C.prototype.toggleInteraction = function (i, second) {
    var that = this;
    var interaction = this.params.interactions[i];

    if (second < interaction.from || second > interaction.to) {
      // Remove interaction
      if (this.visibleInteractions[i] !== undefined) {
        this.visibleInteractions[i].remove();
        delete this.visibleInteractions[i];
      }
      return;
    }

    if (this.visibleInteractions[i] !== undefined) {
      return; // Interaction already exists.
    }

    // Add interaction
    var className = interaction.action.library.split(' ')[0].replace('.', '-').toLowerCase();

    var $interaction = this.visibleInteractions[i] = $('<a href="#" class="h5p-interaction ' + className + ' h5p-hidden" data-id="' + i + '" style="top:' + interaction.y + '%;left:' + interaction.x + '%"></a>').appendTo(this.$overlay).click(function () {
      if (that.editor === undefined) {
        that.showDialog(interaction);
      }
      return false;
    });

    if (this.editor !== undefined) {
      // Append editor magic
      this.editor.newInteraction($interaction);
    }

    // Transition in
    setTimeout(function () {
      $interaction.removeClass('h5p-hidden');
    }, 1);

    if (interaction.pause && this.playing) {
      this.pause();
    }

    return $interaction;
  };

  /**
   * Display interaction dialog.
   *
   * @param {Object} interaction
   * @returns {undefined}
   */
  C.prototype.showDialog = function (interaction) {
    var that = this;

    if (this.playing) {
      this.pause(true);
    }

    this.$dialog.html('<div class="h5p-dialog-interaction"></div>');

    var interactionInstance = new (H5P.classFromName(interaction.action.library.split(' ')[0]))(interaction.action.params, this.contentPath);
    interactionInstance.attach(this.$dialog.children());

    this.$dialogWrapper.show();
    setTimeout(function () {
      that.$dialogWrapper.removeClass('h5p-hidden');
    }, 1);
  };

  /**
   * Formats time in H:MM:SS.
   *
   * @param {float} seconds
   * @returns {string}
   */
  C.humanizeTime = function (seconds) {
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    minutes = minutes % 60;
    seconds = Math.floor(seconds % 60);

    var time = '';

    if (hours !== 0) {
      time += hours + ':';

      if (minutes < 10) {
        time += '0';
      }
    }

    time += minutes + ':';

    if (seconds < 10) {
      time += '0';
    }

    time += seconds;

    return time;
  };

  return C;
})(H5P.jQuery);