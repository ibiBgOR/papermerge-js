import _ from "underscore";
import $ from "jquery";
import { Model, Collection } from 'backbone';

export class Node extends Model {
    defaults() {
      return {
        title: '',
        parent_id: '',
        ctype: '',
        kvstore: '',
        selected: false,
        img_src: '',
        created_at: '',
        user_perms: {}
      };
    }

    initialize(parent_id) {
    }

    urlRoot() {
        return '/node/';
    }

    toJSON() {
        let dict = {
            id: this.get('id'),
            parent_id: this.get('parent_id'),
            title: this.get('title'),
            created_at: this.get('created_at')
        }

        return dict;
    }

    get url() {
        if (this.is_document()) {
            // this url corresponds to backend's 
            // reverse('core:document', args=(doc_id))
            // and is used to open admin/documet.html template.
            return this.get('document_url');
        }

        // this form of url is used for folder browsing via json requests.
        return `/#${this.get('id')}`;
    }

    full_title() {
        return this.get('title');
    }

    short_title(len) {
        let result,
            text = this.get('title');

        if (text && text.length > len) {
            result = `${text.substring(0, len)}...`;
        } else {
            result = text;
        }

        return result;
    }

    is_document() {
        if (this.get('ctype') == 'document') {
            return true;
        }

        return false;
    }

    is_folder() {
        if (this.get('ctype') == 'folder') {
            return true;
        }

        return false;
    }

    find_page_kvstore_for(key) {
        /**
        * Returns kvstore of the provided key in first page
        of corresponding document.
        In browser list mode (and in document viewer if no page is selected)
        it is metadata of the first page displayed.
        **/
        let pages, kvstore, first_page, index;

        // pages are relevant only of nodes which are Documents.
        if (this.is_folder()) {
            return undefined;
        }
        pages = this.get('pages');

        if (pages) {
            first_page = pages[0];
            kvstore = first_page.kvstore;
            if (kvstore) {
                index = _.findIndex(kvstore, function(kv) { 
                    return kv.key == key;
                });

                if (index >= 0) {
                    return kvstore[index];
                }
            }
        }

        return undefined;
    }

    get_page_value_for(key) {
        let page_kvstore;

        page_kvstore = this.find_page_kvstore_for(key);
        
        if (page_kvstore) {
            return page_kvstore.value;
        }

        return ''
    }

    get_page_virtual_value_for(key) {
        let page_kvstore;

        page_kvstore = this.find_page_kvstore_for(key);
        
        if (page_kvstore) {
            return page_kvstore.virtual_value;
        }

        return ''
    }

    is_readonly() {
        let user_perms = this.get('user_perms'), result;

         result = user_perms['read'];
         result = result && !user_perms['write'];
         result = result && !user_perms['delete'];
         result = result && !user_perms['change_perm'];
         result = result && !user_perms['take_ownership'];

         return result;
    }
}

export class NodeCollection extends Collection {
    
    get model() {
        return Node;
    }

    urlRoot() {
        return '/nodes/';
    }

    collection_post_action(url, options, extra_data) {
      let token, post_data, request;

      token = $("[name=csrfmiddlewaretoken]").val();
      
      post_data = this.models.map(
          function(models) { 
              return models.attributes;
          }
      );

      if (extra_data) {
        post_data = {...post_data, ...extra_data}
      }

      $.ajaxSetup({
          headers: { 'X-CSRFToken': token}
      });

      request = $.ajax({
          method: "POST",
          url: url,
          data: JSON.stringify(post_data),
          contentType: "application/json",
          dataType: 'json'
      });

      request.done(options['success']);  
    }

    delete(options) {
        this.collection_post_action(
            this.urlRoot(),
            options
        )
    }

    cut(options) {
        this.collection_post_action(
            '/cut-node/',
            options
        );
    }

    _paste(url, options, parent_id) {
        let token, request;

        token = $("[name=csrfmiddlewaretoken]").val();
        
        $.ajaxSetup({
            headers: { 'X-CSRFToken': token}
        });

        request = $.ajax({
            method: "POST",
            url: url,
            data: JSON.stringify({'parent_id': parent_id}),
            contentType: "application/json",
            dataType: 'json'
        });

        request.done(options['success']);  
    }

    paste(options, parent_id) {
        // pastes folder or document
        this._paste('/paste-node/', options, parent_id);
    }

    paste_pages(options, parent_id) {
        // pastes pages
        this._paste('/paste-pages/', options, parent_id);
    }
}
