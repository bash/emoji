(function () {
  'use strict';

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var inherits = function (subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };

  var possibleConstructorReturn = function (self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

  /**
   * (c) 2016 Ruben Schmidmeister
   */

  var EmojiItem = function (_HTMLElement) {
    inherits(EmojiItem, _HTMLElement);

    function EmojiItem(name, imageSrc) {
      classCallCheck(this, EmojiItem);

      var _this = possibleConstructorReturn(this, Object.getPrototypeOf(EmojiItem).call(this));

      _this._name = name;
      _this._imageSrc = imageSrc;
      _this.className = 'emoji-item';

      return _this;
    }

    createClass(EmojiItem, [{
      key: 'connectedCallback',
      value: function connectedCallback() {

        var image = document.createElement('img');
        image.src = this._imageSrc;
        image.className = 'image';

        this.appendChild(image);

        var name = document.createElement('span');
        name.innerText = ':' + this._name + ':';
        name.className = 'name';

        this.appendChild(name);

        this.setAttribute('emoji-name', this._name);
      }
    }]);
    return EmojiItem;
  }(HTMLElement);

  var ENDPOINT_URL = 'https://api.github.com/emojis';

  var EmojiList = function (_HTMLElement) {
    inherits(EmojiList, _HTMLElement);

    function EmojiList() {
      classCallCheck(this, EmojiList);

      /**
       * 
       * @type {Array<string>}
       */
      var _this = possibleConstructorReturn(this, Object.getPrototypeOf(EmojiList).call(this));

      _this._emojiNames = [];

      /**
       * 
       * @type {Map<string,string>}
       */
      _this._emojis = new Map();

      /**
       * 
       * @type {Map<string,Element>}
       */
      _this._elements = new Map();
      return _this;
    }

    createClass(EmojiList, [{
      key: 'connectedCallback',
      value: function connectedCallback() {
        var _this2 = this;

        fetch(ENDPOINT_URL).then(function (resp) {
          return resp.json();
        }).then(function (emojis) {

          var names = Object.keys(emojis);
          var map = names.map(function (key) {
            return [key, emojis[key]];
          });

          _this2._emojis = new Map(map);
          _this2._emojiNames = names;

          _this2._render();
        });
      }
    }, {
      key: '_render',
      value: function _render() {
        var _this3 = this;

        this._emojis.forEach(function (imageSrc, name) {
          window.setTimeout(function () {
            var item = new EmojiItem(name, imageSrc);

            _this3.appendChild(item);

            _this3._elements.set(name, item);
          });
        });
      }
    }, {
      key: 'filter',
      value: function filter(query) {

        var normalizedQuery = query.toLowerCase().trim();
        var matches = {};

        this._emojiNames.forEach(function (name) {
          var order = name.indexOf(normalizedQuery);
          var show = order !== -1;

          matches[name] = { order: order, show: show };
        });

        this._elements.forEach(function (element, name) {
          var match = matches[name];

          if (match.show) {
            element.style.order = match.order;
            element.style.display = '';
          } else {
            element.style.display = 'none';
          }
        });
      }
    }]);
    return EmojiList;
  }(HTMLElement);

  /**
   * (c) 2016 Ruben Schmidmeister
   */

  var EmojiSearch = function (_HTMLInputElement) {
    inherits(EmojiSearch, _HTMLInputElement);

    function EmojiSearch() {
      classCallCheck(this, EmojiSearch);

      var _this = possibleConstructorReturn(this, Object.getPrototypeOf(EmojiSearch).call(this));

      _this._onInput = _this._onInput.bind(_this);
      return _this;
    }

    createClass(EmojiSearch, [{
      key: 'connectedCallback',
      value: function connectedCallback() {
        this.addEventListener('input', this._onInput);
      }
    }, {
      key: 'disconnectedCallback',
      value: function disconnectedCallback() {
        this.removeEventListener('input', this._onInput);
      }
    }, {
      key: '_onInput',
      value: function _onInput() {

        // TODO: find a better solution for this

        document.querySelector('emoji-list').filter(this.value);
      }
    }]);
    return EmojiSearch;
  }(HTMLInputElement);

  customElements.define('emoji-list', EmojiList);
  customElements.define('emoji-item', EmojiItem);
  customElements.define('emoji-search', EmojiSearch, { extends: 'input' });

}());
//# sourceMappingURL=emoji.js.map
