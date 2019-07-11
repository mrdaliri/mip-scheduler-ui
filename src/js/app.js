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

    constructor(container, graphOptions, nodeTooltipTemplate, edgeTooltipTemplate, layout = 'cose') {
        graphOptions.container = container;
        graphOptions.layout = {name: layout}; // TODO: Define graph layout here with options, then only allow to run it (re-layout graph)
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
            content: Utils.recursiveRendering(element.isNode() ? self.nodeTooltipTemplate : self.edgeTooltipTemplate, element.data()),
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

$(function () {
    const solverAPI = 'http://localhost:8080/solve';

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
        console.log(resultRow);
        resultsTable.find('tr.empty').remove();
        fetch(solverAPI, {
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
                }
                resultRow.find('td:eq(1)').text(Utils.secondsToDuration((Date.now() - startTime) / 1000));
            })
    });
    costsForm.content.on('reset', function () {
        nodesGraph.clear();
        resourcesGraph.clear();
    });
});