import React from 'react';

import FieldNames from '../api/FieldNames';
import Signals from '../api/Signals';

type SearchResultTitleProps = {
  /** The document whose title should be rendered. */
  doc: SearchDocument;
  /**
   * Optional. The location of the node through which to interact with Attivio.
   * Defaults to the value in the configuration.
   */
  baseUri: string;
  title: string | null;
  uri: string | null;
};

type SearchResultTitleDefaultProps = {
  baseUri: string;
};

/**
 * The title of a given document in the search results. Any HTML markup in
 * the title is preserved so that highlighting, entities, and sentiment can
 * be displayed. It can optionally be made clickable, by passing a callback.
 */
export default class SearchResultTitle extends React.Component<SearchResultTitleDefaultProps, SearchResultTitleProps, void> {
  static defaultProps = {
    baseUri: '',
  };

  constructor(props: SearchResultTitleProps) {
    super(props);
    (this: any).handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  titleLink: ?HTMLAnchorElement;

  handleDocumentClick() {
    if (this.titleLink) {
      this.titleLink.blur();
    }
    if (this.props.doc.signal) {
      new Signals(this.props.baseUri).addSignal(this.props.doc);
    }
    const uri = this.props.uri ? this.props.uri : this.props.doc.getFirstValue(FieldNames.URI);
    window.open(uri, '_blank');
  }

  render() {
    let title = this.props.title ? this.props.title : this.props.doc.getFirstValue(FieldNames.TITLE);
    if (!title) {
      title = '<span className="none">This document has no title</span>';
    }
    const uri = this.props.uri ? this.props.uri : this.props.doc.getFirstValue(FieldNames.URI);
    let titleComp;

    if (uri) {
      titleComp = (
        <a
          onClick={this.handleDocumentClick}
          role="button"
          tabIndex={0}
          dangerouslySetInnerHTML={{ __html: title }} // eslint-disable-line react/no-danger
          ref={(c) => { this.titleLink = c; }}
        />
      );
    } else {
      titleComp = <span dangerouslySetInnerHTML={{ __html: title }} />; // eslint-disable-line react/no-danger
    }

    return (
      <h2 className="attivio-search-result-title">
        {titleComp}
      </h2>
    );
  }
}
