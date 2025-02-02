'use strict';

import { newDispatcher } from './dispatcher';
import { isTopResultsPage } from './filters';

var debug = 0 ? console.log.bind(console, '[search-input]') : function() {};

export function newSearchInputController() {
	var dispatcher = newDispatcher();

	/**
	 * The input form is a div with the contenteditable attribute.
	 * 
	 * This allows rich styling, but we also need this to save and restore
	 * the cursor position.
	 * 
	 * @param  {} root the contenteditable element.
	 */
	const saveSelection = function(root) {
		var selection = window.getSelection();
		if (selection.rangeCount === 0) {
			return function() {};
		}
		var range = selection.getRangeAt(0);
		var preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(root);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		let pos = preCaretRange.toString().length;

		return function restoreSelection() {
			var length = 0;
			var posEl = 0;

			var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, function next(el) {
				length += el.textContent.length;
				if (length >= pos) {
					posEl = el.textContent.length;
					return NodeFilter.FILTER_ACCEPT;
				}
				return NodeFilter.FILTER_REJECT;
			});

			var node = treeWalker.nextNode();
			if (!node) {
				return;
			}

			selection.removeAllRanges();
			var range = new Range();
			range.setStart(node, posEl);
			selection.addRange(range);
		};
	};

	var self = {
		query: null, // The query object received from filters.
		queryString: '', // The query string from input.
		matchedWords: new Set(),
		focus: false,
		searchOpen: isTopResultsPage()
	};

	self.init = function() {
		debug('init');
	};

	self.dispatch = function() {
		if (!this.searchOpen) {
			return;
		}
		let input = this.$refs.searchInput;
		let queryString = input.innerText.trim();
		dispatcher.applySearchFilters({ filters: { q: queryString }, triggerSearch: true });
	};

	self.close = function() {
		this.$refs.searchInput.innerHTML = '';
		this.searchOpen = false;
		this.setFocus(false);
		dispatcher.searchToggle(false);
	};

	self.onTurbolinksBeforeRender = function(data) {
		this.searchOpen = false;
	};

	self.setFocus = function(focus) {
		this.focus = focus;
	};

	self.click = function() {
		if (!this.searchOpen) {
			this.searchOpen = true;
			this.dispatch();
			let input = this.$refs.searchInput;
			input.focus();
			this.setFocus(true);
		}
	};

	self.closeWord = function(id) {
		let el = self.$refs[id];
		el.remove();
		self.dispatch();
	};

	self.hasQuery = function() {
		return this.query !== null && this.query.q;
	};

	self.renderInput = function() {
		let input = this.$refs.searchInput;
		let inputTextContent = input.textContent;
		if (!inputTextContent && !this.hasQuery()) {
			return;
		}
		let text = '';
		if (this.focus) {
			text = inputTextContent.replace(/\n/g, '');
		} else if (self.query) {
			text = self.query.q;
		}

		let inputWords = text.split(/(\s+)/);
		var counter = 0;

		// eslint-disable-next-line quotes
		const timesIcon = `<svg class="fill-current text-white ml-1 h-4 w-4"><use href="#icon--times"></use></svg>`;

		// Preserve cursor state.
		var restore = saveSelection(input);
		input.innerHTML = '';

		const createEl = function(str) {
			let root = document.createElement('root');
			root.innerHTML = str;
			return root.firstChild;
		};

		inputWords.forEach((word) => {
			if (word.length >= 2 && self.matchedWords.has(word.toLowerCase())) {
				counter++;
				let id = `w${counter}`;
				let classes = 'bg-brand text-white font-semibold pl-3 pr-2 py-2 capitalize rounded';
				let button = createEl(`<button class="pl-1" @click.once="closeWord('${id}')">${timesIcon}</button>`);
				let span1 = createEl(`<span x-ref="${id}" class="${classes}"></span>`);
				let span2 = createEl(`<span class="inline-flex items-center"></span>`);
				let span3 = document.createElement('span');
				// Setting innerText on a span is safe.
				span3.innerText = word;
				span3.appendChild(button);
				span2.appendChild(span3);
				span1.appendChild(span2);
				input.appendChild(span1);
			} else {
				let span = createEl(`<span class="py-2"></span>`);
				// Setting innerText on a span is safe.
				span.innerText = word;
				input.appendChild(span);
			}
		});

		restore();
	};

	self.receiveData = function(data) {
		debug('receiveData', data);
		this.query = data.query;
		let matchedWords = data.mainSearch.results.getMatchedWords();
		matchedWords.forEach(this.matchedWords.add, this.matchedWords);
		this.renderInput();
	};

	return self;
}
