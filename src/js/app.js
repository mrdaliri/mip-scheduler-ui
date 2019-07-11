class CreateForm {
    _container;
    _graph;
    _tempData;
    _form;

    constructor(container, graph) {
        this._container = container;
        this._graph = graph;
        this._form = new Form(container.find('form'));
        this._registerGraphEvents();
        this._registerFormEvents();
        this._registerModalEvents();
    }

    get tempData() {
        return this._tempData;
    }

    set tempData(value) {
        this._tempData = value;
    }

    get graph() {
        return this._graph;
    }

    get container() {
        return this._container;
    }

    get form() {
        return this._form;
    }

    _show() {
        let self = this;
        this.container.modal();
        return this;
    }

    hide() {
        this.container.modal('hide');
        return this;
    }

    _reset() {
        this.form.reset();
        return this;
    }

    _registerGraphEvents() {
        let self = this;

        this.graph.content.on('tap', function (e) {
            if (e.target === self.graph.content) {
                self.ask(e.renderedPosition);
            }
        });
    }

    _registerFormEvents() {
        let self = this;

        this.container.find('.submit').click(function () {
            self.form.submit();
        });
        this.form.content.submit(function (e) {
            e.preventDefault();
            self.generate().hide();
        });
    }

    _registerModalEvents() {
        let self = this;

        this.container.on('shown.bs.modal', function () {
            self.form.focus();
        });
    }

    _populateForm() {
        this.form.content.find('input[name="id"]').val(this.graph.nodes.length + 1);
    }

    ask(data) {
        if (data) {
            this.tempData = data;
        }
        this._populateForm();
        this._show();
        return this;
    }

    generate(reset = true) {
        let data = this.form.getData();
        this.graph.addNode({'data': data, 'position': this.tempData});
        this._reset();
        return this;
    }
}

class CreateEdgeForm extends CreateForm {
    _registerGraphEvents() {
        let self = this;

        this.graph.content.on('select', 'node', function (e) {
            if (self.tempData && self.tempData.hasOwnProperty('source')) {
                self.tempData.target = e.target;

                let edges = self.tempData.source.edgesWith(self.tempData.target);
                if (edges.length === 0 || (!edges[0].data('bidirectional') && edges[0].source() !== self.tempData.source)) {
                    self.tempData.unidirectional = !(edges.length === 0);
                    self.ask();
                } else {
                    self.graph.nodes.unselect();
                }
            } else {
                self.tempData = {source: e.target};
            }
        });
        this.graph.content.on('unselect', 'node', function (e) {
            self.tempData = {};
        });
    }

    _registerModalEvents() {
        super._registerModalEvents();

        let self = this;
        this.container.on('hide.bs.modal', function () {
            self.graph.nodes.unselect();
        });
    }

    _populateForm() {
        this.form.content.find('input[name="source"]').val(this.tempData.source.data('label'));
        this.form.content.find('input[name="target"]').val(this.tempData.target.data('label'));

        this.form.content.find('input[name="bidirectional"]').prop('disabled', this.tempData.unidirectional);
    }

    generate() {
        let data = this.form.getData();
        if (data.hasOwnProperty('bidirectional') && data.bidirectional === 'on') {
            data.bidirectional = true;
        }
        this.graph.addEdge({'data': data, source: this.tempData.source, target: this.tempData.target});
        this._reset();
        return this;
    }
}

class Form {
    _content;

    constructor(content) {
        this._content = content;
    }

    get content() {
        return this._content;
    }

    set content(value) {
        this._content = value;
    }

    getData() {
        return this.content.serializeArray().reduce((a, x) => ({...a, [x.name]: x.value}), {});
    }

    focus() {
        this.content.find('input[tabindex=1]').focus();
        return this;
    }

    submit() {
        /* Since browser form validation (HTML5 feature) won't get triggered on form's submit() event,
           we should simulate form submission via firing click event on one of its submit buttons.
          (for more information, take a look at https://stackoverflow.com/a/12647431/501134)
         */
        this.content.find('input[type="submit"]').click();
        return this;
    }

    reset() {
        this.content[0].reset();
        return this;
    }
}

class Graph {
    _content;
    _container;
    _nodeTooltipTemplate;
    _edgeTooltipTemplate;
    _layout;

    constructor(container, graphOptions, nodeTooltipTemplate, edgeTooltipTemplate, layout = 'grid') {
        graphOptions.container = container;
        this._content = cytoscape(graphOptions);
        this._container = container;
        this._nodeTooltipTemplate = nodeTooltipTemplate;
        this._edgeTooltipTemplate = edgeTooltipTemplate;
        this._layout = layout;
    }

    get content() {
        return this._content;
    }

    get nodes() {
        return this.content.nodes();
    }

    get edges() {
        return this.content.edges();
    }

    get container() {
        return this._container;
    }

    get nodeTooltipTemplate() {
        return this._nodeTooltipTemplate;
    }

    set nodeTooltipTemplate(value) {
        this._nodeTooltipTemplate = value;
    }

    get edgeTooltipTemplate() {
        return this._edgeTooltipTemplate;
    }

    set edgeTooltipTemplate(value) {
        this._edgeTooltipTemplate = value;
    }

    get layout() {
        return this._layout;
    }

    set layout(value) {
        this._layout = value;
        // this._layout = this.content.layout({name: value});
    }

    // Adopted from
    // http://andreafalzetti.github.io/blog/2016/10/22/render-es6-javascript-template-literals-contained-variable.html
    static recursive_rendering(string, context, stack) {
        for (let key in context) {
            if (context.hasOwnProperty(key)) {
                if (typeof context[key] === "object") {
                    string = Graph.recursive_rendering(string, context[key], (stack ? stack + '.' : '') + key);
                } else {
                    let find = '\\$\\{\\s*' + (stack ? stack + '.' : '') + key + '\\s*\\}';
                    let re = new RegExp(find, 'g');
                    string = string.replace(re, context[key]);
                }
            }
        }
        return string;
    }

    addNode({data, position} = {}) {
        let node = this.content.add({
            group: 'nodes',
            data: data,
            renderedPosition: position
        })[0];
        this._attachTooltip(node);
        return this;
    }

    addEdge({data, source, target} = {}) {
        data.source = source.id();
        data.target = target.id();
        let edge = this.content.add({
            group: 'edges',
            data: data,
            classes: data.bidirectional ? 'undirected' : 'directed'
        })[0];
        this._attachTooltip(edge);
        return this;
    }

    _attachTooltip(element) {
        let self = this;
        return tippy(element.popperRef(), {
            content: Graph.recursive_rendering(element.isNode() ? self.nodeTooltipTemplate : self.edgeTooltipTemplate, element.data()),
            trigger: 'manual',
            arrow: true,
            placement: 'bottom',
            hideOnClick: false,
            sticky: true,
            interactive: true,
            zIndex: 5
        }).show();
    }

    runLayout() {
        this.content.layout({name: this.layout}).run();
        return this;
    }
}

$(function () {
    let nodesGraph = new Graph(
        $('#nodes-graph'),
        {
            boxSelectionEnabled: false,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                    }
                }
            ],
            elements: {
                nodes: [
                    {data: {id: 'a', label: 'ff'}},
                    {data: {id: 'b', label: 'ccc'}},
                    {data: {id: 'n0', label: 'ddd'}},
                ],
                edges: [
                    {data: {id: 'ab', source: 'a', target: 'b', bandwidth: 12.5}}
                ]
            },
        },
        $('#node-tooltip').html(),
        $('#edge-tooltip').html()
    );

    let createNode = new CreateForm($('#create-node-modal'), nodesGraph);
    let createEdge = new CreateEdgeForm($('#create-edge-modal'), nodesGraph);
    $('#nodes-graph-layout').click(function () {
        nodesGraph.runLayout();
    });

    let resourcesGraph = new Graph(
        $('#resources-graph'),
        {
            boxSelectionEnabled: false,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                    }
                },
                {
                    selector: 'edge.undirected',
                    style: {
                        'target-arrow-shape': 'none'
                    }
                }
            ]
        },
        $('#resource-tooltip').html(),
        $('#link-tooltip').html()
    );
    let createResource = new CreateForm($('#create-resource-modal'), resourcesGraph);
    let createLink = new CreateEdgeForm($('#create-link-modal'), resourcesGraph);
    $('#resources-graph-layout').click(function () {
        resourcesGraph.runLayout();
    });
});