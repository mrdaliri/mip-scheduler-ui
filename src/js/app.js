class ModalForm {
    _container;
    _form;

    constructor(container) {
        this._container = container;
        this._form = new Form(container.find('form'));
        this._registerFormEvents();
        this._registerModalEvents();
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

    _populateForm() { }

    ask(data) {
        this._populateForm();
        this._show();
        return this;
    }

    generate() {
        return this;
    }
}

class CreateForm extends ModalForm {
    _graph;
    _tempData;

    constructor(container, graph) {
        super(container);
        this._graph = graph;
        this._registerGraphEvents();
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

    _registerGraphEvents() {
        let self = this;

        this.graph.content.on('tap', function (e) {
            if (e.target === self.graph.content) {
                self.ask(e.renderedPosition);
            }
        });

        this.graph.content.on('cxttap', 'node', function (e) {
            let element = e.target;
            self.ask(element);
            self.form.populate(element.data()); // HACK
            self.form.content.find('input[name="id"]').prop("readonly", true);
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

    generate() {
        let data = this.form.getData();
        if (this.tempData.id) { // edit instance
            this.graph.editElement(this.tempData, data);
        } else {
            this.graph.addNode({'data': data, 'position': this.tempData});
        }
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

        // HACK
        this.graph.content.on('cxttap', 'edge', function (e) {
            let element = e.target;
            self.ask(element);
            self.form.populate(element.data()); // HACK
            self.form.content.find('input[name="id"]').prop("readonly", true);
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
        if (typeof this.tempData.source === "object") {
            this.form.content.find('input[name="source"]').val(this.tempData.source.data('label'));
            this.form.content.find('input[name="target"]').val(this.tempData.target.data('label'));

            this.form.content.find('input[name="bidirectional"]').prop('disabled', this.tempData.unidirectional);
        }
    }

    generate() {
        let data = this.form.getData();
        data.bidirectional = data.hasOwnProperty('bidirectional') && data.bidirectional === 'on';

        if (this.tempData.id) { // edit instance
            this.graph.editElement(this.tempData, data);
        } else {
            this.graph.addEdge({'data': data, source: this.tempData.source, target: this.tempData.target});
        }
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

    getData(plain = false) {
        if (plain) {
            return this.content.serialize();
        }

        let result = this.content.serializeArray().reduce((a, x) => ({...a, [x.name]: x.value}), {});
        Object.keys(result).forEach(key => {
            let dotNotation = key.split('.');
            if (dotNotation.length === 2) {
                if (typeof result[dotNotation[0]] == "undefined") {
                    result[dotNotation[0]] = {};
                }
                result[dotNotation[0]][dotNotation[1]] = result[key];
                delete result[key];
            }
        });
        return result;
    }

    populate(data, namespace) {
        let self = this;
        Object.keys(data).forEach(key => {
            let value = data[key];
            if (typeof value == "object") {
                self.populate(value, key);
            } else {
                let inputName = namespace ? `${namespace}.${key}` : key;
                let input = this.content.find(`input[name="${inputName}"]`);
                if (typeof value == "boolean") {
                    input.prop("checked", value);
                } else if (input.attr("type") === "radio") {
                    input.val([value]);
                } else {
                    input.val(value);
                }
            }
        });
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
        let submitButton = this.content.find('input[type="submit"]');
        if (submitButton.length > 0) {
            this.content.find('input[type="submit"]').click();
        } else {
            this.content.submit();
        }
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

    constructor(container, graphOptions, nodeTooltipTemplate, edgeTooltipTemplate, layout = 'breadthfirst') {
        graphOptions.container = container;
        graphOptions.layout = {name: layout}; // TODO: Define graph layout here with options, then only allow to run it (re-layout graph)
        this._content = cytoscape(graphOptions);
        this._container = container;
        this._nodeTooltipTemplate = nodeTooltipTemplate;
        this._edgeTooltipTemplate = edgeTooltipTemplate;
        this._layout = layout;

        let self = this;
        this.content.on('remove', 'node, edge', function (e) {
            self._removeTooltip(e.target);
        });
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
            classes: data.bidirectional ? 'undirected' : 'directed' // TODO: Doesn't work for edit element. Define a new method which first removes the edge and then recreate it.
        })[0];
        this._attachTooltip(edge);
        return this;
    }

    editElement(element, newData) {
        element.data(newData);
        this._removeTooltip(element)._attachTooltip(element);
        return this;
    }

    _attachTooltip(element) {
        let self = this;
        let tippyTooltip = tippy(element.popperRef(), {
            content: Utils.recursiveRendering(element.isNode() ? self.nodeTooltipTemplate : self.edgeTooltipTemplate, element.data()),
            trigger: 'manual',
            arrow: true,
            placement: 'bottom',
            hideOnClick: false,
            sticky: true,
            interactive: true,
            zIndex: 5
        });
        element.scratch('tooltip', tippyTooltip);
        return tippyTooltip.show();
    }

    _removeTooltip(element) {
        let tippyTooltip = element.scratch('tooltip');
        if (tippyTooltip) {
            tippyTooltip.destroy();
        }
        return this;
    }

    runLayout() {
        this.content.layout({name: this.layout}).run();
        return this;
    }

    clear() {
        this.nodes.remove();
        return this;
    }

    static getCollectionData(elements) {
        let result = [];
        elements.forEach(function (element) {
            result.push(element.data());
        });
        return result;
    }
}

class Utils {
    // Adopted from https://stackoverflow.com/a/6313008/501134
    static secondsToDuration(secondsNum) {
        let hours = Math.floor(secondsNum / 3600);
        let minutes = Math.floor((secondsNum - (hours * 3600)) / 60);
        let seconds = secondsNum - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        return hours + ':' + minutes + ':' + seconds;
    }

    // Adopted from
    // http://andreafalzetti.github.io/blog/2016/10/22/render-es6-javascript-template-literals-contained-variable.html
    static recursiveRendering(string, context, stack) {
        for (let key in context) {
            if (context.hasOwnProperty(key)) {
                if (typeof context[key] === "object") {
                    string = Utils.recursiveRendering(string, context[key], (stack ? stack + '.' : '') + key);
                } else {
                    let find = '\\$\\{\\s*' + (stack ? stack + '.' : '') + key + '\\s*\\}';
                    let re = new RegExp(find, 'g');
                    string = string.replace(re, context[key]);
                }
            }
        }
        return string;
    }
}

class SiteWhereLoader extends ModalForm {
    _resourcesGraph;
    constructor(container, resourcesGraph) {
        super(container);
        this._resourcesGraph = resourcesGraph;
    }

    get resourcesGraph() {
        return this._resourcesGraph;
    }

    generate() {
        let self = this;
        let replaceNodes = self.form.getData().replace || false;
        fetch(`${API}/integration/sitewhere/devices?${this.form.getData(true)}`, {
            method: 'GET', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, cors, *same-origin
        })
            .then(response => response.json())
            .then(response => {
                if (replaceNodes) {
                    self.resourcesGraph.clear();
                }
                response.cloud.forEach(resource => {
                    self.resourcesGraph.addNode({
                        data: {
                            id: resource.id,
                            label: resource.token,
                            costs: {},
                            capacity: resource.capacity,
                            placement: "cloud"
                        }
                    });
                });
                response.edge.forEach(resource => {
                    self.resourcesGraph.addNode({
                        data: {
                            id: resource.id,
                            label: resource.token,
                            costs: {},
                            capacity: resource.capacity,
                            placement: "edge"
                        }
                    });
                });
                self.resourcesGraph.runLayout();
            })
            .catch(reason => {
                console.log(reason);
            });
        return this;
    }
}

const API = 'http://localhost:8080';

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
                    {
                        data: {
                            "id": 1,
                            "label": "u1",
                            "consumption": 5,
                            "type": "source",
                            "query_type": "sequence"
                        }
                    },
                    {
                        data: {
                            "id": 2,
                            "label": "u2",
                            "consumption": 10,
                            "type": "none",
                            "query_type": "pattern"
                        }
                    },
                    {
                        data: {
                            "id": 3,
                            "label": "u3",
                            "consumption": 15,
                            "type": "sink",
                            "query_type": "batch_aggregate"
                        }
                    }
                ],
                edges: [
                    {
                        data: {
                            "source": 1,
                            "target": 2,
                            "bandwidth": 10
                        }
                    },
                    {
                        data: {
                            "source": 1,
                            "target": 3,
                            "bandwidth": 10
                        }
                    },
                    {
                        data: {
                            "source": 2,
                            "target": 3,
                            "bandwidth": 10
                        }
                    }
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
            ],
            elements: {
                nodes: [
                    {
                        data: {
                            "id": 1,
                            "label": "r1",
                            "placement": "cloud",
                            "capacity": 10,
                            "costs": {
                                "filter": 1,
                                "sequence": 2,
                                "pattern": 3,
                                "batch_aggregate": 4,
                                "sliding_aggregate": 5
                            }
                        }
                    },
                    {
                        data: {
                            "id": 2,
                            "label": "r2",
                            "placement": "cloud",
                            "capacity": 20,
                            "costs": {
                                "filter": 2,
                                "sequence": 3,
                                "pattern": 4,
                                "batch_aggregate": 5,
                                "sliding_aggregate": 6
                            }
                        }
                    },
                    {
                        data: {
                            "id": 3,
                            "label": "r3",
                            "placement": "edge",
                            "capacity": 5,
                            "costs": {
                                "filter": 3,
                                "sequence": 4,
                                "pattern": 5,
                                "batch_aggregate": 6,
                                "sliding_aggregate": 7
                            }
                        }
                    },
                    {
                        data: {
                            "id": 4,
                            "label": "r4",
                            "placement": "edge",
                            "capacity": 40,
                            "costs": {
                                "filter": 4,
                                "sequence": 5,
                                "pattern": 6,
                                "batch_aggregate": 7,
                                "sliding_aggregate": 8
                            }
                        }
                    }
                ],
                edges: [
                    {
                        data: {
                            "source": 1,
                            "target": 2,
                            "bandwidth": 10,
                            "latency": 2,
                            "bidirectional": true
                        }
                    },
                    {
                        data: {
                            "source": 1,
                            "target": 3,
                            "bandwidth": 2,
                            "latency": 5,
                            "bidirectional": true
                        }
                    },
                    {
                        data: {
                            "source": 1,
                            "target": 4,
                            "bandwidth": 6.25,
                            "latency": 10,
                            "bidirectional": true
                        }
                    },
                    {
                        data: {
                            "source": 2,
                            "target": 3,
                            "bandwidth": 5,
                            "latency": 7,
                            "bidirectional": true
                        }
                    },
                    {
                        data: {
                            "source": 2,
                            "target": 4,
                            "bandwidth": 7.14,
                            "latency": 8,
                            "bidirectional": true
                        }
                    },
                    {
                        data: {
                            "source": 3,
                            "target": 4,
                            "bandwidth": 20,
                            "latency": 4,
                            "bidirectional": false
                        }
                    },
                    {
                        data: {
                            "source": 4,
                            "target": 3,
                            "bandwidth": 20,
                            "latency": 4,
                            "bidirectional": false
                        }
                    }
                ]
            }
        },
        $('#resource-tooltip').html(),
        $('#link-tooltip').html()
    );
    let createResource = new CreateForm($('#create-resource-modal'), resourcesGraph);
    let createLink = new CreateEdgeForm($('#create-link-modal'), resourcesGraph);
    $('#resources-graph-layout').click(function () {
        resourcesGraph.runLayout();
    });

    let costsForm = new Form($('#costs-form'));
    costsForm.content.submit(function (e) {
        e.preventDefault();
        let problem = {
            nodes: Graph.getCollectionData(nodesGraph.nodes),
            edges: Graph.getCollectionData(nodesGraph.edges),
            resources: Graph.getCollectionData(resourcesGraph.nodes),
            links: Graph.getCollectionData(resourcesGraph.edges),
            costs: costsForm.getData()
        };
        if (problem.nodes.length == 0) {
            alert("You must create at least one query.");
            return false;
        }
        if (problem.resources.length == 0) {
            alert("You must create at least one resource.");
            return false;
        }
        // TODO: Confirm whether there is a minimum count constraint (at least one) for edges and links

        let startTime = new Date();
        let resultsTable = $('#results > tbody');
        let requestNum = resultsTable.find('tr:not(.empty)').length + 1;
        let resultRow = $(`<tr><th scope="row">${requestNum}</th><td>${startTime.toLocaleString()}</td><td>&mdash;</td><td class="solution">Processing...</td><td>Submitted</td></tr>`).insertAfter(resultsTable.find('tr:last'));
        resultsTable.find('tr.empty').remove();
        fetch(`${API}/solve`, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, cors, *same-origin
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(problem), // body data type must match "Content-Type" header
        })
            .then(response => response.json())
            .then(response => {
                let solutionColumn = resultRow.find('td:eq(2)');
                let statusColumn = resultRow.find('td:eq(3)');
                if (response.hasOwnProperty('error')) {
                    solutionColumn.text(response.message);
                    statusColumn.text(response.error);
                } else {
                    statusColumn.text('Solved');

                    let allocationTemplate = $('#allocation').html();
                    solutionColumn.empty();
                    response.forEach(allocation => {
                        solutionColumn.append(Utils.recursiveRendering(allocationTemplate, allocation));
                    });

                    costsForm.content[0].reset();
                }
                resultRow.find('td:eq(1)').text(Utils.secondsToDuration((Date.now() - startTime) / 1000));
            })
            .catch(reason => {
                resultRow.find('td:eq(2)').html('&mdash;');
                resultRow.find('td:eq(3)').text('Error');
            });
    });
    costsForm.content.on('reset', function () {
        nodesGraph.clear();
        resourcesGraph.clear();
    });

    let siteWhere = new SiteWhereLoader($('#load-sitewhere-modal'), resourcesGraph);
});