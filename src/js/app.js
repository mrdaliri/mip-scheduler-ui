class CreateForm {
    _container;
    _graph;
    _tempData;
    _form;

    constructor(container, graph) {
        this._container = container;
        this._graph = graph;
        this._form = container.find('form');
        this._registerGraphEvents();
        this._registerFormEvents();
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
        this.container.modal().on('shown.bs.modal', function () {
            self.form.find('input[tabindex=1]').focus();
        });
        return this;
    }

    hide() {
        this.container.modal('hide');
        return this;
    }

    _reset() {
        this.form[0].reset();
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
            self.hide().generate();
        });
        this.form.submit(function () {
            self.hide().generate();
            return false;
        });
    }

    _getFormData() {
        return this.form.serializeArray().reduce((a, x) => ({...a, [x.name]: x.value}), {});
    }

    _populateForm() {
        this.form.find('input[name="id"]').val(this.graph.nodes.length + 1);
    }

    ask(data) {
        this.tempData = data;
        this._populateForm();
        this._show();
        return this;
    }

    generate(reset = true) {
        let data = this._getFormData();
        this.graph.addNode({'data': data, 'position': this.tempData});
        this._reset();
        return this;
    }
}

class CreateEdgeForm extends CreateForm {
    _registerGraphEvents() {
        let self = this;

        this.graph.content.on('select', 'node', function (e) {
            let selectedNodes = self.graph.content.$('node:selected');
            if (selectedNodes.length === 2) {
                self.ask({source: selectedNodes[0], target: selectedNodes[1]})
                selectedNodes.unselect();
            }
        });
    }

    _populateForm() {
        super._populateForm();
        this.form.find('input[name="source"]').val(this.tempData.source.data('label'));
        this.form.find('input[name="target"]').val(this.tempData.target.data('label'));
    }

    generate() {
        let data = this._getFormData();
        this.graph.addEdge({'data': data, source: this.tempData.source, target: this.tempData.target});
        this._reset();
        return this;
    }
}

class Graph {
    _content;
    _container;
    _tooltipTemplate;
    _layout;

    constructor(container, graphOptions, tooltipTemplate, layout = 'grid') {
        graphOptions.container = container;
        this._content = cytoscape(graphOptions);
        this._container = container;
        this._tooltipTemplate = tooltipTemplate;
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

    get tooltipTemplate() {
        return this._tooltipTemplate;
    }

    set tooltipTemplate(value) {
        this._tooltipTemplate = value;
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
        this.attachTooltip(node);
        return this;
    }

    addEdge({data, source, target} = {}) {
        data.source = source.id();
        data.target = target.id();
        let edge = this.content.add({
            group: 'edges',
            data: data
        });
    }

    attachTooltip(node) {
        let self = this;
        return tippy(node.popperRef(), {
            content: Graph.recursive_rendering(self.tooltipTemplate, node.data()),
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
                        'label': 'data(bandwidth)'
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
        $('#node-tooltip').html()
    );

    let createNode = new CreateForm($('#create-node-modal'), nodesGraph);
    let createEdge = new CreateEdgeForm($('#create-edge-modal'), nodesGraph);
    $('#nodes-graph-layout').click(function () {
        nodesGraph.runLayout();
    });
});