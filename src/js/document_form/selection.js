import {DgEvents} from "../events";


export class MgSelection {
    // digilette (dg) was renamed to papermerge (mg)
    /**
    A list of selected pages from current document
    **/
    static get DELETE() {
        return "mg_delete_selected_page";
    }

    constructor() {
      this._list = [];
      this._events = new DgEvents();
      this._configEvents();
    }

    subscribe_event(name, handler, context) {
      this._events.subscribe(name, handler, context);
    }

    notify_subscribers(event_name) {
      this._events.notify(event_name);
    }

    add(mg_page) {
      let pos;

      pos = this._list.findIndex(
         item => item.id == mg_page.id
      );
      // add mg_page only if it is not already in the list.
      if (pos < 0) {
        this._list.push(mg_page);
      }
    }

    all() {
      return this._list;
    }

    first() {
      return this._list[0];
    }

    remove(mg_page) {
      let pos;

      pos = this._list.findIndex(
        item => item.id == mg_page.id
      );

      if (pos >= 0) {
        this._list.splice(pos, 1);  
      }
    }
}