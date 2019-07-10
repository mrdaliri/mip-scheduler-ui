class CreateForm {
    _container;
    _graph;
    _position;
    _form;

    constructor(container, graph) {
        this._container = container;
        this._graph = graph;
        this._form = container.find('form');
        this._registerEvents();
    }

    get position() {
        return this._position;
    }

    set position(value) {
        this._position = value;
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
            self.form.find('input:first').focus();
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

    _registerEvents() {
        let self = this;

        this.graph.content.on("tap", function (e) {
            if (e.target === self.graph.content) {
                self.ask(e.renderedPosition);
            }
        });

        this.container.find('.submit').click(function () {
            self.hide().generate();
        });
        this.form.submit(function () {
            self.hide().generate();
            return false;
        });
    }

    ask(position, reset) {
        this.position = position;
        if (reset) {
            this._reset()._show();
        } else {
            this._show();
        }
        return this;
    }

    generate() {
        let data = this.form.serializeArray().reduce((a, x) => ({...a, [x.name]: x.value}), {});
        this.graph.addNode(new Node(data), this.position);
        this._reset();
        return this;
    }
}

class Graph {
    _content;
    _container;
    _nodes = [];
    _edges = [];
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
        return this._nodes;
    }

    get edges() {
        return this._edges;
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

    addNode(node, position) {
        let id = `${node.label}-${this.nodes.length}`;
        this.nodes.push(node);
        this.content.add({
            group: 'nodes',
            data: {id: id, label: node.label},
            renderedPosition: position
        });
        this.attachTooltip(id, node);
        return this;
    }

    attachTooltip(id, node) {
        let self = this;
        let graphNode = this.content.getElementById(id);
        return tippy(graphNode.popperRef(), {
            content: Graph.recursive_rendering(self.tooltipTemplate, node), // TODO: replace Node class with graph's node data
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

class Node {
    label;
    consumption;
    type;
    query_type;

    constructor({label, consumption, type, query_type} = {}) {
        this.label = label;
        this.consumption = parseFloat(consumption);
        this.type = type;
        this.query_type = query_type;
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
                        'target-arrow-shape': 'triangle'
                    }
                }
            ]
        },
        $('#node-tooltip').html()
    );

    let createNode = new CreateForm($('#create-node-modal'), nodesGraph);
    $('#nodes-graph-layout').click(function () {
        nodesGraph.runLayout();
    });
});