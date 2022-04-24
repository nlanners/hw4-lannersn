const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

const bodyParser = require('body-parser');
const {Datastore} = require('@google-cloud/datastore');
// const { response } = require('express');
const datastore = new Datastore({
    projectId: 'hw4-lannersn'
});

app.use(bodyParser.json());

// CONSTANTS
const BOAT = 'Boats';
const LOAD = 'Loads';
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const ERROR = 500;


// MODEL FUNCTIONS

// HELPERS 

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

function createEntity(data) {
    return {
        key: data[Datastore.KEY],
        data: data
    }
}

function createDomain(req, kind) {
    const prot = req.protocol;
    const host = req.get('host');
    return prot + '://' + host + '/' + kind.toLowerCase() + '/';
}

// BOATS

// Create new boat in database
async function post_boat(name, type, length, url){
    let key = datastore.key(BOAT);

    const new_boat = {"name":name, "type":type, "length":length, "loads": [], "self": ""};
    await datastore.save({"key":key, "data":new_boat});
    const [boat] = await datastore.get(key);
    boat.self = url + boat[Datastore.KEY].id;
    await datastore.update({key:key, data:boat});
    return fromDatastore(boat);
                
}

// Get all boats from database
async function get_all_boats() {
    const q = datastore.createQuery(BOAT);
    const [entities] = await datastore.runQuery(q)
    return entities.map(fromDatastore);
}

// Get a single boat from database by id
async function get_boat(id) {
    try {
        const key = datastore.key([BOAT, parseInt(id, 10)]);
        const [boat] = await datastore.get(key);
        return fromDatastore(boat);
    } catch (err) {
        return false;
    }
}

// Delete a boat from database by id
async function delete_boat(id) {
    try {
        let boat = await get_boat(id);

        if (!boat) {
            return NOT_FOUND;
        }
    
        for (let l in boat.loads) {
            let load = await get_load(boat.loads[l].id);
            load.carrier = null;
            await datastore.update(createEntity(load));
        }
    
        return datastore.delete(boat[Datastore.KEY]);
    } catch (err) {
        console.log(err);
    }   
}

// Put load on boat in the database
async function assign_load_to_boat(boat_id, load_id) {
    try {
        let boat = await get_boat(boat_id);
        let load = await get_load(load_id);

        if (boat && load) {
            if (load.carrier != null) {
                return FORBIDDEN;
            } else {
                boat.loads.push({"id": load.id, "self": load.self});
                load.carrier = {"id": boat.id, "name": boat.name, "self": boat.self};
                
                await datastore.update(createEntity(boat));
                await datastore.update(createEntity(load));
                return NO_CONTENT;
            }
        } else {
            return NOT_FOUND;
        }
        
    } catch (err) {
        console.log(err);
    }
}

// Remove a load from a boat in the database
async function remove_load_from_boat(boat_id, load_id) {
    try {
        let load = await get_load(load_id);
        let boat = await get_boat(boat_id);
        if (load.carrier === null || !boat || !load) {
            return NOT_FOUND;
        } else {
            load.carrier = null;
            let boatLoads = boat.loads.filter( value => value.id != load.id);
            boat.loads = boatLoads;
            
            await datastore.update(createEntity(boat));
            await datastore.update(createEntity(load));

            return NO_CONTENT;
        }
    } catch (err) {
        console.log(err);
    }
}

// Get all the loads on a boat in the database
async function get_boat_loads(boat_id) {
    try {
        const boat = await get_boat(boat_id);
        if (boat && boat.loads.length > 0) {
            let loads = [];
            boat.loads.forEach(async (load) => {
                let l = await get_load(load.id);
                loads.push(l);
            });
            return loads;
        } else {
            return false;
        }
        
    } catch (err) {
        console.log(err);
    }
    
}

// LOADS

// Create a load in the database
async function post_load(volume, item, date, url) {
    try {
        const key = datastore.key(LOAD);
    const new_load = {"volume": volume, "item": item, "carrier": null, "creation_date": date, "self": ""};

    await datastore.save({"key":key, "data":new_load});
    const [load] = await datastore.get(key);
    load.self = url + load[Datastore.KEY].id;
    await datastore.update({key:key, data:load});
    return fromDatastore(load);
    } catch (err) {
        console.log(err);
    }
}

// Get all loads from database
async function get_all_loads() {
    const q = datastore.createQuery(LOAD);
    const [entities] = await datastore.runQuery(q)
    return entities.map(fromDatastore);
}

// Get one load from database
async function get_load(id) {
    try {
        const key = datastore.key([LOAD, parseInt(id, 10)]);
        const [load] = await datastore.get(key);
        return fromDatastore(load);
    } catch (err) {
        return false;
    }
}

// Delete a load from database
async function delete_load(id) {
    try {
        const load = await get_load(id);

        if (!load) {
            return NOT_FOUND;
        }

        if (load.carrier != null) {
            let boat = await get_boat(load.carrier.id);
            let boatLoads = boat.loads.filter( value => value.id != load.id);
            
            boat.loads = boatLoads;
            await datastore.update(createEntity(boat));
        }
        return await datastore.delete(load[Datastore.KEY]);

    } catch (err) {
        console.log(err);
    }
}


// Routes

// CREATE a boat in database
app.post('/boats', async (req, res) => {
    if (req.body.name && req.body.type && req.body.length) {
        try {
            const url = createDomain(req, BOAT);
            const boat = await post_boat(req.body.name, req.body.type, req.body.length, url);
            res.status(CREATED).json( boat );
        } catch (err) {
            res.status(ERROR).json({"Error": "Something went wrong creating the boat. Please try again"});
        }
    } else {
        res.status(BAD_REQUEST).json({"Error": "The request object is missing at least one of the required attributes"});
    }
});

// READ all boats in database
// TODO IMPLEMENT PAGINATION*******************************************************
app.get('/boats', async (req, res) => {
    const boats = await get_all_boats();
    res.status(OK).json({"boats": boats});
});

// READ one boat from database
app.get('/boats/:boat_id', async (req, res) => {
    const boat = await get_boat(req.params.boat_id)
    if (boat) {
        res.status(OK).json(boat);
    } else {
        res.status(NOT_FOUND).json({"Error": "No boat with this boat_id exists"});
    }
});

// DELETE a boat from database
app.delete('/boats/:boat_id', async (req, res) => {
    try {
        const stuff = await delete_boat(req.params.boat_id)
        if (stuff === NOT_FOUND) {
            res.status(NOT_FOUND).json({"Error":"No boat with this boat_id exists"});
        } else {
            res.status(NO_CONTENT).end();
        }
    } catch (err) {
        console.log(err);
    }
});

// CREATE a load
app.post('/loads', async (req, res) => {
    if (req.body.volume && req.body.item && req.body.creation_date) {
        try {
            const url = createDomain(req, LOAD);
            const load = await post_load(req.body.volume, req.body.item, req.body.creation_date, url);
            res.status(CREATED).json( load )
        } catch (err) {
            res.status(BAD_REQUEST).json({"Error": "Something went wrong creating the load. Please try again"})
        }
    } else {
        res.status(BAD_REQUEST).json({"Error": "The request object is missing at least one of the required attributes"});
    }
});

// READ all loads in database
// TODO IMPLEMENT PAGINATION*******************************************************
app.get('/loads', async (req, res) => {

    try {
        const loads = await get_all_loads();
        res.status(OK).json({"loads": loads});
    } catch (err) {
        console.log(err);
    }
});

// READ one load from database
app.get('/loads/:load_id', async (req, res) => {
    const load = await get_load(req.params.load_id);
    if (load) {
        res.status(OK).json(load);
    } else {
        res.status(NOT_FOUND).json({"Error": "No load with this load_id exists"});
    }
});

// DELETE a load from database
app.delete('/loads/:load_id', async (req, res) => {
    try {
        const status = await delete_load(req.params.load_id)
        if(status == NOT_FOUND) {
            res.status(NOT_FOUND).json({"Error":"No load with this load_id exists"});
        } else {
            res.status(NO_CONTENT).end();
        }
    } catch (err) {
        console.log(err);
    }
});

// PUT load on boat
app.put('/boats/:boat_id/loads/:load_id', async (req, res) => {
    try {
        const status = await assign_load_to_boat(req.params.boat_id, req.params.load_id);
        switch (status) {
            case NO_CONTENT:
                res.status(NO_CONTENT).end();
                break;
            
            case NOT_FOUND:
                res.status(NOT_FOUND).json({"Error": "The specified boat and/or load does not exist"});
                break;

            case FORBIDDEN:
                res.status(FORBIDDEN).json({"Error": "The load is already loaded on another boat"});
                break;

            default:
                res.status(ERROR).json({"Error": "Something went wrong. Please try again"});
                break;
        }
    } catch (err) {
        console.log(err);
    }
});

// DELETE a load from a boat
app.delete('/boats/:boat_id/loads/:load_id', async (req, res) => {
    try {
        const status = await remove_load_from_boat(req.params.boat_id, req.params.load_id);
        switch (status) {
            case NO_CONTENT:
                res.status(NO_CONTENT).end();
                break;

            case NOT_FOUND:
                res.status(NOT_FOUND).json({"Error": "No boat with this boat_id is loaded with the load with this load_id"});
                break;

            default:
                res.status(ERROR).json({"Error": "Something went wrong. Please try again."});
                break;
        }
    } catch (err) {
        console.log(err);
    }
});

// GET all loads on a single boat
app.get('/boats/:boat_id/loads', async (req, res) => {
    try {
        const loads = await get_boat_loads(req.params.boat_id);
        if (loads) {
            res.status(OK).json({"loads": loads});
        } else {
            res.status(NOT_FOUND).json({"Error": "No boat with this boat_id exists"});
        }
        

    } catch (err) {
        console.log(err);
    }
});



app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});