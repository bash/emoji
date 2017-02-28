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

    function EmojiItem() {
      classCallCheck(this, EmojiItem);
      return possibleConstructorReturn(this, Object.getPrototypeOf(EmojiItem).apply(this, arguments));
    }

    createClass(EmojiItem, [{
      key: 'emojiName',
      get: function get() {
        return this.getAttribute('emoji-name');
      }
    }]);
    return EmojiItem;
  }(HTMLElement);

  var EmojiList = function (_HTMLElement) {
    inherits(EmojiList, _HTMLElement);

    function EmojiList() {
      classCallCheck(this, EmojiList);
      return possibleConstructorReturn(this, Object.getPrototypeOf(EmojiList).apply(this, arguments));
    }

    createClass(EmojiList, [{
      key: 'filter',
      value: function filter(query) {

        var normalizedQuery = query.toLowerCase().trim();

        var result = this.emojiItems.map(function (item) {
          var name = item.emojiName;
          var order = name.indexOf(normalizedQuery);
          var show = order !== -1;

          return { item: item, order: order, show: show };
        });

        result.forEach(function (_ref) {
          var item = _ref.item;
          var order = _ref.order;
          var show = _ref.show;

          if (show) {
            item.style.order = order;
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      }
    }, {
      key: 'emojiItems',
      get: function get() {
        return Array.from(this.querySelectorAll('emoji-item'));
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
