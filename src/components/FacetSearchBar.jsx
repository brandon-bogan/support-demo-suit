// @flow
import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';

import Dropdown from 'react-bootstrap/lib/Dropdown';
import Glyphicon from 'react-bootstrap/lib/Glyphicon';
import MenuItem from 'react-bootstrap/lib/MenuItem';

import Configurable from './Configurable';
import AutoCompleteInput from './AutoCompleteInput';
import FacetFilter from '../api/FacetFilter';
import SimpleQueryRequest from '../api/SimpleQueryRequest';


declare var webkitSpeechRecognition: any; // Prevent complaints about this not existing

type SearchBarProps = {
  history: PropTypes.object.isRequired;
  /** If set, this will be styled to live inside a <code>&lt;Masthead&gt;</code> component. */
  inMasthead: boolean;
  /** The placeholder text to display when the input field is empty. Defaults to "Search…". */
  placeholder: string;
  /**
   * The placeholder text to display when the input field is empty and the language
   * is advanced. Defaults to "Enter an advanced query…".
   */
  placeholderAdvanced: string;
  /** Whether to show a toggle for simple/advanced language in the search bar */
  allowLanguageSelect: boolean;
  /**
   * If set, the "microphone" button is displayed and the user can use speech
   * recognition to input the query terms.
   */
  allowVoice: boolean;
  /**
   * If set, the search bar's input field will use autocomplete via this URI.
   * Otherwise, if the configuration is available, the autoCompleteUri in the configuration will be used.
   * Otherwise, the search bar will not autocomplete.
   */
  autoCompleteUri: string;
  /** The label to show on the search button. Defaults to "Go". */
  buttonLabel: string;
  /** If set, this is the route to navigate to upon executing a search. By default, no navigation will occur when searching. */
  route: string | null;
};

type SearchBarDefaultProps = {
  inMasthead: boolean;
  placeholder: string;
  placeholderAdvanced: string;
  allowLanguageSelect: boolean;
  allowVoice: boolean;
  buttonLabel: string;
  autoCompleteUri: string;
  route: string | null;
  name: string;
  label: string;
    /** Callback to add a filter for this facet. */
  addFacetFilter: (bucket: SearchFacetBucket) => void;
  maxValues: number;
};

type SearchBarState = {
  recognizing: boolean;
  suggestions: Array<string>;
};

/**
 * Component to include in the Masthead for entering the query
 * to use when searching. Must be inside a Searcher component.
 */
class FacetSearchBar extends React.Component<SearchBarDefaultProps, SearchBarProps, SearchBarState> {
  static contextTypes = {
    searcher: PropTypes.any,
  };

  static defaultProps: SearchBarDefaultProps = {
    inMasthead: true,
    placeholder: 'Search…',
    placeholderAdvanced: 'Enter an advanced query…',
    buttonLabel: 'Go',
    allowLanguageSelect: false,
    allowVoice: false,
    autoCompleteUri: 'http://localhost:17000/rest/autocompleteApi/richCgi/dictionaryProvider',
    route: null,
    name: '*',
    label: '',
    maxValues: 5,
  };

  static AUTOCOMPLETE_THRESHOLD = 20;

  constructor(props: SearchBarProps) {
    super(props);
    this.state = {
      query: '',
      recognizing: false,
      suggestions: [],
      facetValue: '',
    };
    (this: any).doKeyPress = this.doKeyPress.bind(this);
    (this: any).doSearch = this.doSearch.bind(this);
    (this: any).startSpeechRecognition = this.startSpeechRecognition.bind(this);
    (this: any).queryChanged = this.queryChanged.bind(this);
    (this: any).updateQuery = this.updateQuery.bind(this);
    (this: any).languageChanged = this.languageChanged.bind(this);
    (this: any).addFilter = this.addFilter.bind(this);
    (this: any).handleSearchResults = this.handleSearchResults.bind(this);
    if (this.props.allowVoice && !('webkitSpeechRecognition' in window)) {
      console.log('Requested speech recognition but the browser doesn’t support it'); // eslint-disable-line no-console
    }
  }

  state: SearchBarState;

  getSuggestionList() {
    if (!this.state.suggestions || this.state.suggestions.length === 0) {
      return null;
    }
    var suggestionsAdded = 0;
    const contents = this.state.suggestions.map((suggestion, index) => {
      var include = suggestion.displayLabel().length >= this.state.query.length;
      // include = include && suggestion.displayLabel().toLowerCase().substring(0, this.state.query.length).indexOf(this.state.query.toLowerCase()) !== -1;
      include = include && suggestion.displayLabel().toLowerCase().indexOf(this.state.query.toLowerCase()) !== -1;
      if(include && suggestionsAdded < this.props.maxValues){
        suggestionsAdded++;
        return <button className={'facet-suggestion'} key={index} onClick={() => this.addFilter(index)} style={{width: '300px', textAlign:'left', borderWidth: '0px', backgroundColor: '#FFFFFF'}}><MenuItem eventKey={index} key={index} onSelect={this.addFilter} tabIndex={index}>
           {suggestion.displayLabel() + ' (' + suggestion.count + ')'}
              </MenuItem></button>;        
      }
    });
    if(contents.length > 0){
      return (
        <div  className={'facet-suggestion'} style={{width: '300px', border:'1px solid #D2D2D2', passingTop: '11px'}}>
        <ul role="menu">
          {contents}
        </ul>
        </div>
      );
    } else {
      return null;
    }
  }

  submitButton: ?HTMLButtonElement;

  startSpeechRecognition() {
    const recognition = new webkitSpeechRecognition(); // eslint-disable-line new-cap,no-undef
    recognition.continuous = true;
    recognition.interrimResults = true;
    // recognition.lang = 'en';

    recognition.onresult = (e: any) => {
      recognition.stop();
      const newQuery = e.results[0][0].transcript;
      if (e.results[0].isFinal) {
        const searcher = this.context.searcher;
        if (searcher) {
          searcher.performQueryImmediately(newQuery);
        }
      }
      this.setState({
        recognizing: false,
      });
    };

    recognition.onerror = () => {
      recognition.stop();
      this.setState({
        recognizing: false,
      });
    };

    recognition.start();
    this.setState({
      recognizing: true,
    });
  }

  languageChanged(newLanguage: 'simple' | 'advanced') {
    const searcher = this.context.searcher;
    if (searcher && newLanguage) {
      searcher.updateQueryLanguage(newLanguage);
    }
  }

  updateQuery(newQuery: string, doSearch: boolean = false) {
    if(doSearch){
      this.setState({facetValue: newQuery, query: newQuery}, this.doSearch());
    } else {
      this.setState({facetValue: newQuery, query: newQuery});
    }
  }

  queryChanged(e: Event) {
    if (e.target instanceof HTMLInputElement) {
      const newQuery = e.target.value;
      this.setState({facetValue: newQuery, query: newQuery});
    } 
  }

  advancedMenuItem: ?HTMLSpanElement;
  simpleMenuItem: ?HTMLSpanElement;

  route() {
    const searcher = this.context.searcher;
    if (this.props.route && searcher) {
      // TODO: this should be using it's own location property, but that's not updating for some reason
      this.props.history.push({ pathname: this.props.route, search: searcher.props.location.search });
    }
  }

  addFilter(eventKey, event) {
    this.props.addFacetFilter(this.state.suggestions[eventKey]);
    event.target.blur();
    this.setState({suggestions: [], query: ''});
  }

  addFilter(eventKey){
    this.props.addFacetFilter(this.state.suggestions[eventKey]);
    event.target.blur();
    this.setState({suggestions: [], query: ''});
  }

  handleSearchResults(response: ?QueryResponse, error: ?string) {
    if (response) {
      var facets = response.facets[0].buckets;
      this.setState({suggestions: facets});
    } else if (error) {
      // Failed!
      this.setState({
        suggestions: undefined,
        error,
      });
    }
  }

  doConfiguredSearch(queryTerm: string, maxBuckets: number, callback, searcher) {
    
    if (searcher) {
      var searchTerm = searcher.state.query;
      // searchTerm = 'AND(' + searchTerm + ',' + this.props.name + ':*' + queryTerm + '*)';

      var simpleQR = new SimpleQueryRequest();
      simpleQR.query = searchTerm;
      simpleQR.facets = [this.props.name + '(maxBuckets=' + maxBuckets + ')'];
      simpleQR.facetFilters = searcher.state.facetFilters;
      simpleQR.filters = [];
      if(searcher.getQueryRequest().filters && searcher.getQueryRequest().filters.length > 0){
        Array.prototype.push.apply(simpleQR.filters, searcher.getQueryRequest().filters);
      }
      simpleQR.filters.push(this.props.name + ":" + queryTerm);
      // simpleQR.facetFilters.push({facetName: this.props.name, bucketLabel: this.props.label, filter: this.props.name + ":FACET(" + queryTerm + ")"});
      console.log('filters: ', simpleQR.filters);
      simpleQR.rows = 0;
      simpleQR.queryLanguage = 'simple';
      simpleQR.workflow = searcher.getQueryRequest().workflow;

      searcher.doCustomSearch(simpleQR, callback);
    }
  }

  doSearch(){
    var callback = this.handleSearchResults;
    this.doConfiguredSearch(this.state.facetValue + "*", this.props.maxValues * 2, callback, this.context.searcher);
  }

  getAllFacetValues(callback, searchFunction) {
    function localCallback(qr: ?QueryResponse, error: ?string) {
      if (qr) {
        var facets = qr.facets[0].buckets;
        var response  = [];
        facets.map((facet) => {
          response.push({'Facet Value':facet.displayLabel(), 'Document Count': facet.count});
        });
        callback(response);
      } else if (error) {
        // Failed!
        return [];
      }
    };
    this.doConfiguredSearch('*', -1, localCallback, this.context.searcher);
  }

  convertArrayOfObjectsToCSV(args) {  
        var result, ctr, keys, columnDelimiter, lineDelimiter, data;

        data = args.data || null;
        if (data == null || !data.length) {
            return null;
        }

        columnDelimiter = args.columnDelimiter || ',';
        lineDelimiter = args.lineDelimiter || '\n';

        keys = Object.keys(data[0]);

        result = '';
        result += keys.join(columnDelimiter);
        result += lineDelimiter;

        data.forEach(function(item) {
            ctr = 0;
            keys.forEach(function(key) {
                if (ctr > 0) result += columnDelimiter;

                result += item[key];
                ctr++;
            });
            result += lineDelimiter;
        });

        return result;
    }

  downloadCSV(args) {
      var callback = (data) => {       
          var filename, link;
          var csv = this.convertArrayOfObjectsToCSV({
              data: data
          });
          if (csv == null) return;

          filename = args.filename || this.props.name + '_facet_values.csv';

          if (!csv.match(/^data:text\/csv/i)) {
              csv = 'data:text/csv;charset=utf-8,' + csv;
          }
          data = encodeURI(csv);

          link = document.createElement('a');
          link.setAttribute('href', data);
          link.setAttribute('download', filename);
          link.click();
      };
      this.getAllFacetValues(callback, this.doConfiguredSearch);  
  }

  doKeyPress(e: Event) {
    // If the user presses enter, do the search
    if (e.target instanceof HTMLInputElement) {
      if (e.keyCode === 13) {
        this.doSearch();
      }
    }
  }

  render() {
    const showMicrophone = this.props.allowVoice && ('webkitSpeechRecognition' in window);
    const micStyle = {};
    if (this.state.recognizing) {
      micStyle.backgroundSize = '125%';
    }

    const containerClass = this.props.inMasthead ? 'attivio-globalmast-search-container' : '';
    const inputClass = this.props.inMasthead ? 'form-control attivio-globalmast-search-input facet-search-bar' : 'form-control';

    let query = this.state.query;
    let language = 'simple';
    const searcher = this.context.searcher;
    // if (searcher) {
    //   query = searcher.state.query;
    //   language = searcher.state.queryLanguage;
    // }

    const simpleMenuItem = (
      <MenuItem
        onSelect={() => {
          this.languageChanged('simple');
          if (this.simpleMenuItem) {
            this.simpleMenuItem.blur();
          }
        }}
      >
        <span ref={(c) => { this.simpleMenuItem = c; }}>
          <span style={{ visibility: language === 'simple' ? 'visible' : 'hidden' }}>&#x2713;</span>
          {' '}
          Simple
        </span>
      </MenuItem>
    );
    const advancedMenuItem = (
      <MenuItem
        onSelect={() => {
          this.languageChanged('advanced');
          if (this.advancedMenuItem) {
            this.advancedMenuItem.blur();
          }
        }}
      >
        <span ref={(c) => { this.advancedMenuItem = c; }}>
          <span style={{ visibility: language === 'advanced' ? 'visible' : 'hidden' }}>&#x2713;</span>
          {' '}
          Advanced
        </span>
      </MenuItem>
    );

    const languageControl = this.props.allowLanguageSelect ? (
      <Dropdown
        id="myDropdown"
        className=""
        onSelect={this.languageChanged}
        componentClass="div"
        style={{ display: 'inline-block' }}
      >
        <Dropdown.Toggle
          noCaret
          useAnchor
          className="attivio-smalltoolbar-btn"
          bsClass="attivio-smalltoolbar-btn"
          title="Query Language"
          style={{
            position: 'relative',
            top: '1px',
            left: '-2px',
            color: '#fff',
            border: 'none',
            background: 'transparent',
          }}
        >
          <Glyphicon glyph="search" style={{ color: 'white' }} />
          {' '}
          <span className="attivio-globalmast-icon attivio-icon-arrow-down-blue" />
        </Dropdown.Toggle>
        <Dropdown.Menu
          style={{
            paddingTop: 0,
            paddingBottom: 0,
          }}
        >
          {simpleMenuItem}
          {advancedMenuItem}
        </Dropdown.Menu>
      </Dropdown>
    ) : '';

    let placeholder = this.props.placeholder;
    if (this.props.allowLanguageSelect && language === 'advanced') {
      placeholder = this.props.placeholderAdvanced;
    }

    const suggestionList = this.getSuggestionList();
    const inputComponent = this.props.autoCompleteUri ?
      (
        <AutoCompleteInput
          uri={this.props.autoCompleteUri}
          updateValue={this.updateQuery}
          placeholder={placeholder || ''}
          value={query}
          className={inputClass}
          style={{minWidth: '300px'}}
          autocompleteThreshold={200}
        />
      ) : (
        <input
          type="search"
          className={inputClass}
          placeholder={placeholder}
          onChange={this.queryChanged}
          onKeyDown={this.doKeyPress}
          value={query}
          style={{minWidth: '300px'}}
        />
      );
    return (
      <div className={containerClass}>
        <div className="attivio-globalmast-search" role="search" style={{ display: 'inline-block' }}>
          <div className="form-group">
            {inputComponent}
            {showMicrophone ? (
              <a onClick={this.startSpeechRecognition} role="button" tabIndex={0}>
                <span className="attivio-globalmast-search-mic-icon attivio-icon-microphone" style={micStyle} />
              </a>
            ) : ''}
            <button
              type="submit"
              className="btn attivio-globalmast-search-submit"
              onClick={this.doSearch}
              style={{height: '25px'}}
              ref={(c) => { this.submitButton = c; }}
            >
              {this.props.buttonLabel}
            </button>
          </div>
          {suggestionList}
        </div>
        <div><button id={this.props.name} className="btn attivio-globalmast-search-submit" style={{height: '25px', position: 'relative'}} href='#' onClick={() => this.downloadCSV({})}>Export to CSV</button></div>
      </div>
    );
  }
}

export default withRouter(Configurable(FacetSearchBar));