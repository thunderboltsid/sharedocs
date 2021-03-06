var 
    sharedb = require('sharedb/lib/client')
    richText = require('rich-text'),
    quill = require('quill'),
    showdown  = require('showdown');

var constants = require('../shared/constants.js');

// setup sharedb types
sharedb.types.register(richText.type);

/**
 * Creates a new Editor instance. 
 * @param {string} doc Name of the document to load
 * @param {DOM} editorElement Element representing the document
 * @param {DOM} previewElement Element representing the preview
 */
function EditorClient(doc, token, docElement, previewElement) {
    // store the document as well as the elements
    this.doc = doc;
    this.token = token;
    this.docElement = docElement;
    this.previewElement = previewElement;
    
    // and create an editor
    this.editor = new quill(
        this.docElement, 
        {
            theme: 'snow', 
            formats: [], 
            modules: {
                toolbar: false
            }
        }
    );
    
    // create a previewer
    this.preview = new showdown.Converter()
    
    // we are not yet connected
    this.connected = false;
    this.transport = null;
    this.connection = null;
    this.share = null;
};

/**
 * Connects this editor to a connection endpoint and starts editing
 *
 * @param {TransportClient} transport Transport connection to use for communication
 */
EditorClient.prototype.connect = function(transport){
    // if we are already connected, quit
    if(this.connected){
        return false;
    }
    
    // we are now connected
    this.connected = true;
    
    // and have a transport
    this.transport = transport;
    
    // setup a connection and bind it to the transport
    this.connection = new sharedb.Connection(this.transport.diffStream);
    
    // create a share and subscribe
    this.share = this.connection.get(constants.collection_documents, this.doc);
    
    // and setup all the events
    this._bindEvents();
}



/**
 * Binds all the editor events
 */
EditorClient.prototype._bindEvents = function(){
    var me = this;
    
    this.share.subscribe(function(err) {
        
        // if there was an error, throw it
        if (err) throw err;
        
        // set the initial contents of the editor
        me.editor.setContents(me.share.data);
        me._updatePreview();
        
        // send all changes to to the server
        me.editor.on('text-change', function(delta, oldDelta, source) {
            if (source !== 'user') return;
            me.share.submitOp(delta, {source: quill});
            me._updatePreview();
        });
        
        // see all changes from the server
        me.share.on('op', function(op, source) {
            if (source === quill) return;
            me.editor.updateContents(op);
            me._updatePreview();
            
        });
    });
    
    // listen to broadcasts
    this.transport.broadcastStream.on('data', function(data){
        me._displayMessage(data[constants.field_message]);
    });
}

/** Updates the preview */
EditorClient.prototype._updatePreview = function(){
    // TODO: Have a different set of editor
    this.previewElement.innerHTML = this.preview.makeHtml(this.editor.getText());
}

/**
 * Displays a message to the user
 * @param {string} message message to display
 */
EditorClient.prototype._displayMessage = function(message){
    var div = document.createElement('div');
    div.innerText = message;
    div.className = 'alert alert-info';
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.right = '0';
    
    document.body.appendChild(div);
    
    window.setTimeout(function(){
        document.body.removeChild(div);
    }, 10000);
};

module.exports.EditorClient = EditorClient;