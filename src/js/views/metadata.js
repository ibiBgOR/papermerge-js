import $ from "jquery";
import _ from "underscore";
import { Metadata } from "../models/metadata";
import { KVStore, KVStoreComp } from "../models/kvstore";
import { View } from 'backbone';

let TEMPLATE = require('../templates/metadata.html');

export class MetadataView extends View {
    /***
        Manages the sidebar control (the one on the left side)
        view for metadata (of files and folder).
        Sidebar control contains other views besides this one.
    **/
    el() {
        return $('#metadata');
    } 

    initialize(doc_id) {
        this.metadata = new Metadata(doc_id);
        this.start();
        this.render();
    }

    get all_disabled() {
        return this.metadata.all_disabled;
    }

    start() {
        // start listening on this.metadata object
        // which will trigger view rendering
        this.listenTo(this.metadata, 'change', this.render);
    }

    stop() {
        // stops listening
        // and remove html associated to this elem.
        this.stopListening(this.metadata);
        this.$el.html('');
    }

    events() {
        let event_map = {
          "click #add_simple_meta": "add_simple_meta",
          "click .close.key": "remove_meta",
          "keyup input": "update_value",
          "change input": "update_value",
          "change .kv_type": "kv_type_update",
          "change .kv_format": "kv_format_update",
          "click button.save": "on_save"
        }

        return event_map;
    }


    kv_format_update(event) {
        let value = $(event.currentTarget).val();
        let parent = $(event.currentTarget).closest("li");
        let data = parent.data();

        this.metadata.update_simple(data['cid'],'kv_format', value);

        this.render();  
    }

    kv_type_update(event) {
        let value = $(event.currentTarget).val();
        let parent = $(event.currentTarget).closest("li");
        let data = parent.data();
        let cur_fmt = {};

        cur_fmt['money'] = this.metadata.get('currency_formats');
        cur_fmt['numeric'] = this.metadata.get('numeric_formats');
        cur_fmt['date'] = this.metadata.get('date_formats');
        cur_fmt['text'] = [];

        this.metadata.update_simple(data['cid'],'kv_type', value);
        this.metadata.update_simple(data['cid'],'current_formats', cur_fmt[value]);
        if (cur_fmt[value].length > 0) {
            // kv_format entry is a 2 items array. First one is used as value
            // in HTML <option> and second one is the human text
            // cur_fmt[value][0][0] == use first *value* of first format from the list
            this.metadata.update_simple(data['cid'],'kv_format', cur_fmt[value][0][0]);
        } else {
            // current list of formatting types is empty only for kv_type text
            // no formating - means kv_type = text
            this.metadata.update_simple(data['cid'],'kv_format', "");
        }

        this.render();
    }

    update_value(event) {
        let value = $(event.currentTarget).val();
        let parent = $(event.currentTarget).closest("li");
        let data = parent.data();

        this.metadata.update_simple(data['cid'], 'key', value);
    }

    add_simple_meta(event) {
        let value = $(event.currentTarget).val();
        
        this.metadata.add_simple();
        
        this.render();
    }

    remove_meta(event) {
        let parent = $(event.currentTarget).parent();
        let $li_container = $(event.currentTarget).closest("li");
        let data = parent.data();

        this.metadata.remove_simple(data['cid']);
        
        $li_container.remove();
        this.render();
    }

    on_save() {
        this.metadata.save();
    }

    render() {
        let compiled, context;

        context = {
            'kvstore': this.metadata.get('kvstore'),
            'available_types': this.metadata.get('kv_types')
        }

        compiled = _.template(TEMPLATE({
            kvstore: this.metadata.kvstore,
            available_types: this.metadata.get('kv_types'),
            all_disabled: this.all_disabled
        }));

        this.$el.html(compiled);
        
        return this;
    }
};
