import $ from "jquery";
import _ from "underscore";
import { Browse } from "../models/browse";
import { DisplayModeView } from "./display_mode";
import { View } from 'backbone';
import Backbone from 'backbone';
import {
    mg_dispatcher,
    PARENT_CHANGED,
    SELECTION_CHANGED,
    BROWSER_REFRESH,
    SELECT_ALL,
    SELECT_FOLDERS,
    SELECT_DOCUMENTS,
    DESELECT,
    INVERT_SELECTION,
} from "../models/dispatcher";
import { mg_browse_router } from "../routers/browse";


let TEMPLATE_GRID = require('../templates/browse_grid.html');
let TEMPLATE_LIST = require('../templates/browse_list.html');

let SORT_ASC = 'asc';
let SORT_DESC = 'desc';
let SORT_UNDEFINED = 0;


class Column {

    constructor(name, key, sort) {
      this._name = name;
      this._key = key;
      this._sort = this.get_local(name) || sort;
    }

    get key() {
      return this._key;
    }

    get name() {
      return this._name;
    }

    get sort() {
      return this._sort;
    }

    set sort(sort_state) {
      this._sort = sort_state;
      this.set_local(this.name, sort_state);
    }

    get_local(name) {
      let local = localStorage.getItem(`browse_list.${name}`);
      
      if (local == "0" || local == undefined) {
        return SORT_UNDEFINED;
      };

      return local;
    }

    set_local(name, value) {
      localStorage.setItem(`browse_list.${name}`, value); 
    }

    toggle() {
      // changes sorting state of the column
      // if sort is undefined - initial sort is ASC
      if (this.sort == SORT_UNDEFINED || this.sort == undefined) {
        this.sort = SORT_ASC;
      } else if (this.sort == SORT_ASC) {
        this.sort = SORT_DESC;
      } else if (this.sort == SORT_DESC) {
        this.sort = SORT_ASC;
      }
    }

    get sort_icon_name() {
      let fa_name = 'fa-sort';

      if (this.sort == SORT_ASC) {
        fa_name = 'fa-sort-amount-down-alt';
      } else if (this.sort == SORT_DESC) {
        fa_name = 'fa-sort-amount-down';
      } 

      return fa_name;
    }
}


class Table {

  constructor(nodes, parent_kv) {
    let cols, sort_column;

    this._cols = this._build_header_cols(parent_kv)
    cols = this._cols;
    this._rows = this._build_rows(parent_kv, nodes);

    sort_column = this.get_sort_column();
    
    if (sort_column) {
      if (sort_column.key) {
    
        this.sort_key_column(
          sort_column.key,
          (sort_column.sort == SORT_ASC) ? -1 : 1
        );
    
      } else {
        this.sort_standard_column(
          sort_column.name,
          (sort_column.sort == SORT_ASC) ? -1 : 1
        );
      }
    }
  }

  get_sort_column() {
    let index = _.findIndex(this._cols, function(col) { 
      return col.sort == SORT_ASC || col.sort == SORT_DESC ;
    });

    if (index >= 0) {
      return this._cols[index];
    }

    return undefined;
  }
  
  get cols() {
    return this._cols;
  }

  get rows() {
    return this._rows;
  }

  get key_cols() {
    let result = [];

    result = _.filter(
      this.cols,
      function(item){ return item.key != undefined; }
    );

    return result;
  }

  toggle_col_sort(index) {
    this._cols[index].toggle();
    // Set as sort = undefined for all other columns
    // Only one column at the time is supported.
    for(let i=0; i < this._cols.length; i++ ) {
      if (i != index ) {
        this._cols[i].sort = SORT_UNDEFINED;
      }
    }

    return this._cols[index];
  }

  sort_key_column(key_name, sort_type) {
    
    function compare_keys( row1, row2 ) {
      let found_1 , found_2;

      found_1 = _.find(row1, function(item) {return item['key'] == key_name});
      found_2 = _.find(row2, function(item) {return item['key'] == key_name});

      if ( found_1['virtual_value'] < found_2['virtual_value'] ){
        return sort_type;
      }
      if ( found_1['virtual_value'] > found_2['virtual_value'] ){
          return -sort_type;
      }
      return 0;
    }

    this._rows = this._rows.sort(compare_keys);

  }

  sort_standard_column(name, sort_type) {

    function compare_cols( row1, row2 ) {
      let found_1 , found_2;

      found_1 = _.find(row1, function(item) {return item['col'] == name});
      found_2 = _.find(row2, function(item) {return item['col'] == name});

      if ( found_1['virtual_value'] < found_2['virtual_value'] ){
        return sort_type;
      }
      if ( found_1['virtual_value'] > found_2['virtual_value'] ){
          return -sort_type;
      }
      return 0;
    }
    
    this._rows = this._rows.sort(compare_cols);
  }

  _build_dict_for_type_col(node) {
    let value, virtual_value;

    if (node.is_document()) {
      value = `<i class="fa fa-file"></i>`;
      virtual_value = 0;
    } else {
      value = `<i class="fa fa-folder text-warning"></i>`;
      virtual_value = 1;
    }

    return {
      'id': node.get('id'),
      'cid': node.cid,
      'url': node.url,
      'is_readonly': node.is_readonly(),
      'col': 'type',
      'value': value,
      'virtual_value': virtual_value,
      'virtual_type': 'int'
    }
  }

  _build_dict_for_title_col(node) {
    let value, virtual_value;

    return {
      'id': node.get('id'),
      'cid': node.cid,
      'url': node.url,
      'col': 'title',
      'value': node.full_title_list_mode(),
      'virtual_value': node.full_title(),
      'virtual_type': 'str'
    }
  }

  _build_dict_for_created_at_col(node) {
    let value, virtual_value;

    return {
      'id': node.get('id'),
      'cid': node.cid,
      'url': node.url,
      'col': 'created_at',
      'value': node.get('created_at'),
      'virtual_value': node.get('created_at'),
      'virtual_type': 'str'
    }
  }

  _build_rows(parent_kv, nodes) {
    let node, result = [],
      value,
      virtual_value,
      kvstore,
      key,
      row = [];

    for (let i=0; i < nodes.length; i++) {

        node = nodes.at(i);
        row = [];
        row.push(
          this._build_dict_for_type_col(node)
        );

        row.push(
          this._build_dict_for_title_col(node)
        );

        for (let j=0; j < parent_kv.length; j++) {
          kvstore = parent_kv.at(j)
          if (kvstore) {
            key = kvstore.get('key');
            value = node.get_page_value_for(key);
            virtual_value = node.get_page_virtual_value_for(kvstore.get('key'));
            row.push(
              {
                'id': node.get('id'),
                'cid': node.cid,
                'url': node.url,
                'key': key,
                'value': value,
                'virtual_value': parseInt(virtual_value),
                'virtual_type': 'str'
              }
            )
          } 
        }

        row.push(
          this._build_dict_for_created_at_col(node)
        );
        result.push(row);
    } // for

    return result;
  }

  _build_header_cols(parent_kv) {
    let result = [], kvstore, key, i;

    // there are always at least 3 cols: type, title and
    // created_at.
    // type is always first one
    // title is always second column
    // created_at column is always last one.
    result.push(
      // name, key, sort
      new Column('type', undefined, undefined)
    );

    result.push(
      // name, key, sort
      new Column('title', undefined, undefined)
    );

    for (i=0; i < parent_kv.length; i++) {
      kvstore = parent_kv.at(i);
      key = kvstore.get('key');
      result.push(new Column(key, key, undefined));
    }

    result.push(
      // name, key, sort
      new Column('created_at', undefined, undefined)
    );


    return result;
  }

}

class BrowseListView extends View {
  /**
    List mode displays a table which can be sorted by each individual column.
    Also, some columns might be added or removed.
  **/
  el() {
      return $('#browse');
  }

  initialize() {
    this._table = undefined;
  }

  get table() {
    return this._table;
  }

  get cols() {
    return this._table.cols;
  }

  get rows() {
    return this._table.rows;
  }

  events() {
    let event_map = {
      "click .header.sort": "col_sort"
    }
    return event_map;
  }

  col_sort(event) {
    let data = $(event.currentTarget).data(), key_name, column;

    if (data.col == 'key') {
      // kvstore column was clicked, find out
      // exact key name
      key_name = data.key;
      this.toggle_key_column(key_name);
    } else {
      this.toggle_standard_column(data.col);
    }
    
    event.preventDefault();
    this.trigger("change");
  }

  toggle_key_column(key_name) {
    let index;

    index = _.findIndex(this.cols, function(item) {
        return item.key == key_name;
    });

    if (index >= 0) {
      this.toggle_col_sort(index);
    }
  }

  toggle_col_sort(index) {
    return this._table.toggle_col_sort(index);
  }

  toggle_standard_column(name) {
    let index;

    index = _.findIndex(this.cols, function(item) {
        return item.name == name;
    });

    if (index >= 0) {
      return this.toggle_col_sort(index);
    }
  }

  render(nodes, parent_kv) {
    let compiled, context;
    
    context = {};

    this._table = new Table(nodes, parent_kv);

    compiled = _.template(TEMPLATE_LIST({
        'nodes': nodes,
        'parent_kv': parent_kv,
        'table': this.table
    }));

    this.$el.html(compiled);
  }
}

class BrowseGridView extends View {

  el() {
      return $('#browse');
  }

  render(nodes, sort_field, sort_order) {
    let compiled, context;
    
    context = {};

    compiled = _.template(TEMPLATE_GRID({
        'nodes': nodes,
    }));

    this.$el.html(compiled);
  }
}

export class BrowseView extends View {

  el() {
      return $('#browse');
  } 

  initialize(parent_id) {
    this.browse = new Browse(parent_id);
    // UI used to switch between list and grid display modes
    this.display_mode = new DisplayModeView();

    // there are to view modes - list and grid
    this.browse_list_view = new BrowseListView();
    this.browse_grid_view = new BrowseGridView();

    this.listenTo(this.browse, 'change', this.render);
    this.listenTo(this.display_mode, 'change', this.render);
    this.listenTo(this.browse_list_view, 'change', this.render);

    mg_dispatcher.on(BROWSER_REFRESH, this.refresh, this);
    mg_dispatcher.on(SELECT_ALL, this.select_all, this);
    mg_dispatcher.on(SELECT_FOLDERS, this.select_folders, this);
    mg_dispatcher.on(SELECT_DOCUMENTS, this.select_documents, this);
    mg_dispatcher.on(DESELECT, this.deselect, this);
    mg_dispatcher.on(INVERT_SELECTION, this.invert_selection, this);
  }

  events() {
      let event_map = {
        'dblclick .node': 'open_node',
        'click .node': 'select_node'
      }
      return event_map;
  }

  select_all() {
    this.browse.nodes.each(function(node){
        node.select();
    });

    mg_dispatcher.trigger(
      SELECTION_CHANGED,
      this.get_selection()
    );
  }

  select_folders() {
    this.browse.nodes.each(function(node){
      if (node.is_folder()) {
        node.select();
      }
    });

    mg_dispatcher.trigger(
      SELECTION_CHANGED,
      this.get_selection()
    );
  }

  select_documents() {
    this.browse.nodes.each(function(node){
      if (node.is_document()) {
        node.select();
      }
    });

    mg_dispatcher.trigger(
      SELECTION_CHANGED,
      this.get_selection()
    );
  }

  deselect() {
    this.browse.nodes.each(function(node){
        node.deselect();
    });

    mg_dispatcher.trigger(
      SELECTION_CHANGED,
      this.get_selection()
    );
  }

  invert_selection() {
    this.browse.nodes.each(function(node){
      node.toggle_selection();
    });

    mg_dispatcher.trigger(
      SELECTION_CHANGED,
      this.get_selection()
    );
  }

  select_node(event) {
    let data = $(event.currentTarget).data(),
      node,
      selected,
      new_state,
      $target,
      checkbox;

    $target = $(event.currentTarget);
    node = this.browse.nodes.get(data['cid']);

    if (node) {
      selected = node.get('selected');
      node.set({'selected': !selected});
      new_state = !selected;
      
      if (new_state) {
        $target.addClass('checked');
      } else {
        $target.removeClass('checked');
      }

      mg_dispatcher.trigger(
        SELECTION_CHANGED,
        this.get_selection()
      );
    }
  }

  get_selection() {
    let result;
    
    result = _.filter(
      this.browse.nodes.models, function(item) {
        return item.get('selected') == true;
      }
    );

    return result;
  }

  open_node(event) {
    let data = $(event.currentTarget).data(),
      node;

    node = this.browse.nodes.get(data['cid']);

    // folder is 'browsed' by triggering PARENT_CHANGED event
    if (node.is_folder()) { 
      // routers.browse handles PARENT_CHANGED event.
      if (node) {
        mg_dispatcher.trigger(PARENT_CHANGED, node.id);
      } else {
        mg_dispatcher.trigger(PARENT_CHANGED, undefined);
      }

      return;
    }
    // will reach this place only if node is a document.
    window.location = node.get('document_url');
  }

  open(node_id, tagname) {
    let parent_id = node_id;
    
    this.browse.set({
      'parent_id': node_id,
      'tag': tagname
    });
    
    this.browse.fetch();
  }

  _get_tagname_from_location() {
    /**
    * Checks window.location if there is a "tag" filter:
    * /browse#tagged/employer
    * In case there is a tag filter, returns tagname.
    *
    * Relevant in case when user clicks on pinned tag, and then
    * performs add/remove tags action on currently filted 
    * nodes -> will refresh nodes considernig current tag
    */
    let regexp = /tagged\/(\w+)$/, url = location.href, match;

    match = url.match(regexp);
    if (match) {
      return match[1];
    }

    return undefined;
  }

  refresh() {
    let parent_id = this.browse.get('parent_id'), tagname;

    tagname = this._get_tagname_from_location();
    this.open(parent_id, tagname);
  }

  render() {
    let compiled, context, sort_order, sort_field;
    
    context = {};

    if (this.display_mode.is_list()) {
      this.browse_list_view.render(
        this.browse.nodes,
        this.browse.parent_kv
      );
    } else {
      sort_field = this.display_mode.sort_field;
      sort_order = this.display_mode.sort_order;

      console.log(`Dynamically sorting... by ${sort_field} ${sort_order}`);
      this.browse.nodes.dynamic_sort_by(
        sort_field,
        sort_order
      );
      
      this.browse_grid_view.render(
        this.browse.nodes
      );
    }

    $("#pre-loader").hide();
    
  }

}