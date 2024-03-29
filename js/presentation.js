(function() {
	var doc = document;
	var disableBuilds = false;
	var disableNotes = false;

	var ctr = 0;
	var spaces = /\s+/, a1 = [ '' ];

	var toArray = function(list) {
		return Array.prototype.slice.call(list || [], 0);
	};

	var byId = function(id) {
		if (typeof id == 'string') {
			return doc.getElementById(id);
		}
		return id;
	};

	var query = function(query, root) {
		if (!query) {
			return [];
		}
		if (typeof query != 'string') {
			return toArray(query);
		}
		if (typeof root == 'string') {
			root = byId(root);
			if (!root) {
				return [];
			}
		}

		root = root || document;
		var rootIsDoc = (root.nodeType == 9);
		var doc = rootIsDoc ? root : (root.ownerDocument || document);

		// rewrite the query to be ID rooted
		if (!rootIsDoc || ('>~+'.indexOf(query.charAt(0)) >= 0)) {
			root.id = root.id || ('qUnique' + (ctr++));
			query = '#' + root.id + ' ' + query;
		}
		// don't choke on something like ".yada.yada >"
		if ('>~+'.indexOf(query.slice(-1)) >= 0) {
			query += ' *';
		}

		return toArray(doc.querySelectorAll(query));
	};

	var strToArray = function(s) {
		if (typeof s == 'string' || s instanceof String) {
			if (s.indexOf(' ') < 0) {
				a1[0] = s;
				return a1;
			} else {
				return s.split(spaces);
			}
		}
		return s;
	};

	var addClass = function(node, classStr) {
		classStr = strToArray(classStr);
		var cls = ' ' + node.className + ' ';
		for ( var i = 0, len = classStr.length, c; i < len; ++i) {
			c = classStr[i];
			if (c && cls.indexOf(' ' + c + ' ') < 0) {
				cls += c + ' ';
			}
		}
		node.className = cls.trim();
	};

	var removeClass = function(node, classStr) {
		var cls;
		if (classStr !== undefined) {
			classStr = strToArray(classStr);
			cls = ' ' + node.className + ' ';
			for ( var i = 0, len = classStr.length; i < len; ++i) {
				cls = cls.replace(' ' + classStr[i] + ' ', ' ');
			}
			cls = cls.trim();
		} else {
			cls = '';
		}
		if (node.className != cls) {
			node.className = cls;
		}
	};

	var toggleClass = function(node, classStr) {
		var cls = ' ' + node.className + ' ';
		if (cls.indexOf(' ' + classStr.trim() + ' ') >= 0) {
			removeClass(node, classStr);
		} else {
			addClass(node, classStr);
		}
	};

	var ua = navigator.userAgent;
	var isFF = parseFloat(ua.split('Firefox/')[1]) || undefined;
	var isWK = parseFloat(ua.split('WebKit/')[1]) || undefined;
	var isOpera = parseFloat(ua.split('Opera/')[1]) || undefined;

	var canTransition = (function() {
		var ver = parseFloat(ua.split('Version/')[1]) || undefined;
		// test to determine if this browser can handle CSS transitions.
		var cachedCanTransition = (isWK || (isFF && isFF > 3.6) || (isOpera && ver >= 10.5));
		return function() {
			return cachedCanTransition;
		}
	})();

	//
	// Slide class
	//
	var Slide = function(node, idx) {
		this._node = node;
		var note = query('.note > section', node)[0];
		this._speakerNote = note ? note.innerHTML : '';

		if (idx >= 0) {
			this._count = idx + 1;
		}
		if (this._node) {
			addClass(this._node, 'slide distant-slide');
		}
		this._makeCounter();
		this._makeBuildList();
	};

	Slide.prototype = {
		_node : null,
		_count : 0,
		_buildList : [],
		_visited : false,
		_currentState : '',
		_states : [ 'distant-slide', 'far-past', 'past', 'current', 'future',
				'far-future', 'distant-slide' ],
		setState : function(state) {
			if (typeof state != 'string') {
				state = this._states[state];
			}
			if (state == 'current' && !this._visited) {
				this._visited = true;
				this._makeBuildList();
			}
			removeClass(this._node, this._states);
			addClass(this._node, state);
			this._currentState = state;

			// delay first auto run. Really wish this were in CSS.
			/*
			 * this._runAutos();
			 */
			var _t = this;
			setTimeout(function() {
				_t._runAutos();
			}, 400);

			if (state == 'current') {
				this._onLoad();
			} else {
				this._onUnload();
			}
		},
		_onLoad : function() {
			this._fireEvent('onload');
			this._showFrames();
		},
		_onUnload : function() {
			this._fireEvent('onunload');
			this._hideFrames();
		},
		_fireEvent : function(name) {
			var eventSrc = this._node.getAttribute(name);
			if (eventSrc) {
				eventSrc = '(function() { ' + eventSrc + ' })';
				var fn = eval(eventSrc);
				fn.call(this._node);
			}
		},
		_showFrames : function() {
			var frames = query('iframe', this._node);
			function show() {
				frames.forEach(function(el) {
					var _src = el.getAttribute('_src');
					if (_src && _src.length) {
						el.src = _src;
					}
				});
			}
			setTimeout(show, 0);
		},
		_hideFrames : function() {
			var frames = query('iframe', this._node);
			function hide() {
				frames.forEach(function(el) {
					var _src = el.getAttribute('_src');
					if (_src && _src.length) {
						el.src = '';
					}
				});
			}
			setTimeout(hide, 250);
		},
		_makeCounter : function() {
			if (!this._count || !this._node) {
				return;
			}
			var c = doc.createElement('span');
			c.innerHTML = this._count;
			c.className = 'counter';
			this._node.appendChild(c);
		},
		_makeBuildList : function() {
			this._buildList = [];
			if (disableBuilds) {
				return;
			}
			if (this._node) {
				this._buildList = query('[data-build] > *', this._node);
			}
			this._buildList.forEach(function(el) {
				addClass(el, 'to-build');
			});
		},
		_runAutos : function() {
			if (this._currentState != 'current') {
				return;
			}
			// find the next auto, slice it out of the list, and run it
			var idx = -1;
			this._buildList.some(function(n, i) {
				if (n.hasAttribute('data-auto')) {
					idx = i;
					return true;
				}
				return false;
			});
			if (idx >= 0) {
				var elem = this._buildList.splice(idx, 1)[0];
				var transitionEnd = isWK ? 'webkitTransitionEnd'
						: (isFF ? 'mozTransitionEnd' : 'oTransitionEnd');
				var _t = this;
				if (canTransition()) {
					var l = function(evt) {
						elem.parentNode.removeEventListener(transitionEnd, l,
								false);
						_t._runAutos();
					};
					elem.parentNode.addEventListener(transitionEnd, l, false);
					removeClass(elem, 'to-build');
				} else {
					setTimeout(function() {
						removeClass(elem, 'to-build');
						_t._runAutos();
					}, 400);
				}
			}
		},
		getSpeakerNote : function() {
			return this._speakerNote;
		},
		buildNext : function() {
			if (!this._buildList.length) {
				return false;
			}
			removeClass(this._buildList.shift(), 'to-build');
			return true;
		},
	};

	//
	// SlideShow class
	//
	var SlideShow = function(slides) {
		this._slides = (slides || []).map(function(el, idx) {
			return new Slide(el, idx);
		});

		var h = window.location.hash;
		try {
			this.current = parseInt(h.split('#slide')[1], 10);
		} catch (e) { /* squeltch */
		}
		this.current = isNaN(this.current) ? 1 : this.current;
		var _t = this;
		doc.addEventListener('keydown', function(e) {
			_t.handleKeys(e);
		}, false);
		doc.addEventListener('mousewheel', function(e) {
			_t.handleWheel(e);
		}, false);
		doc.addEventListener('DOMMouseScroll', function(e) {
			_t.handleWheel(e);
		}, false);
		doc.addEventListener('touchstart', function(e) {
			_t.handleTouchStart(e);
		}, false);
		doc.addEventListener('touchend', function(e) {
			_t.handleTouchEnd(e);
		}, false);
		window.addEventListener('popstate', function(e) {
			_t.go(e.state);
		}, false);
		this._update();
	};

	SlideShow.prototype = {
		_speakerNote : query('#speaker-note')[0],
		_slides : [],
		_getCurrentIndex : function() {
			var me = this;
			var slideCount = null;
			query('.slide').forEach(function(slide, i) {
				if (slide.id == me.current) {
					slideCount = i;
				}
			});
			return slideCount + 1;
		},
		_update : function(dontPush) {

			// catch to set things right on the initial load. popstate fires on
			// pageload.
			if (this.current === null)
				return;

			document.querySelector('#presentation-counter').innerText = this.current;
			var currentIndex = this._getCurrentIndex();
			if (this._speakerNote) {
				this._speakerNote.innerHTML = this._slides[this.current - 1]
						.getSpeakerNote();
			}

			if (history.pushState) {
				if (!dontPush) {
					history.pushState(this.current, 'Slide ' + this.current,
							'#slide' + this.current);
				}
			} else {
				window.location.hash = 'slide' + this.current;
			}
			for ( var x = this.current - 1; x < this.current + 7; x++) {
				if (this._slides[x - 4]) {
					this._slides[x - 4].setState(Math.max(0, x - this.current));
				}
			}
		},

		current : 0,
		next : function() {
			if (!this._slides[this.current - 1].buildNext()) {
				this.current = Math.min(this.current + 1, this._slides.length);
				this._update();
			}
		},
		prev : function() {
			this.current = Math.max(this.current - 1, 1);
			this._update();
		},
		go : function(num) {
			if (history.pushState && this.current != num) {
				history.replaceState(this.current, 'Slide ' + this.current,
						'#slide' + this.current);
			}
			this.current = num;
			this._update(true);
		},

		showNotes : function() {
			if (disableNotes) {
				return;
			}
			if (this._speakerNote) {
				this._speakerNote.style.display = 'block';
				this._speakerNote.classList.toggle('invisible');
			}
		},
		switch3D : function() {
			toggleClass(document.body, 'three-d');
		},
		handleWheel : function(e) {
			var delta = 0;
			if (e.wheelDelta) {
				delta = e.wheelDelta / 120;
				if (isOpera) {
					delta = -delta;
				}
			} else if (e.detail) {
				delta = -e.detail / 3;
			}

			if (delta > 0) {
				this.prev();
				return;
			}
			if (delta < 0) {
				this.next();
				return;
			}
		},
		handleKeys : function(e) {
			if (/^(input|textarea)$/i.test(e.target.nodeName)
					|| e.target.isContentEditable) {
				return;
			}
			switch (e.keyCode) {
			case 38: // up arrow
			case 37: // left arrow
				this.prev();
				break;
			case 40: // down arrow
			case 39: // right arrow
			case 32: // space
				this.next();
				break;
			case 66: // B -> for presenter
			case 78: // N
			case 50: // 2
				this.showNotes();
				break;
			case 51: // 3
				this.switch3D();
				break;
			}
		},
		_touchStartX : 0,
		handleTouchStart : function(e) {
			this._touchStartX = e.touches[0].pageX;
		},
		handleTouchEnd : function(e) {
			var delta = this._touchStartX - e.changedTouches[0].pageX;
			var SWIPE_SIZE = 150;
			if (delta > SWIPE_SIZE) {
				this.next();
			} else if (delta < -SWIPE_SIZE) {
				this.prev();
			}
		},
	};

	var li_array = [];
	var transitionSlides = query('.transitionSlide').forEach(
			function(el) {
				li_array.push([ '<li>', query('h2', el)[0].textContent,
						'<img src="',
						query('img', el)[0].src.replace(/64/g, '32'),
						'"/></li>' ].join(''));
			});

	// Initialize
	var slideshow = new SlideShow(query('.slide'));

	var toc_list = query('#toc-list')[0];
	if (toc_list) {
		toc_list.innerHTML = li_array.join('');
		query('li a', toc_list).forEach(function(el) {
			el.onclick = function() {
				slideshow.go(el.dataset['hash']);
			};
		});
	}
})();