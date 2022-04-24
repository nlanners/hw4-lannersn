const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('../lib/datastore');
const Loads = require('./loads.js');

const datastore = ds.datastore;

router.use(bodyParser.json());

module.exports.get_boat = get_boat;

// CONSTANTS
const BOAT = 'Boats';
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const ERROR = 500;

/******************************* MODEL FUNCTIONS ************************************************/

// Create new boat in database
async function post_boat(name, type, length, url){
    let key = datastore.key(BOAT);

    const new_boat = {"name":name, "type":type, "length":length, "loads": [], "self": ""};
    await datastore.save({"key":key, "data":new_boat});
    const [boat] = await datastore.get(key);
    boat.self = url + boat[ds.Datastore.KEY].id;
    await datastore.update({key:key, data:boat});
    return ds.fromDatastore(boat);
                
}

// Get all boats from database
async function get_all_boats(req) {
    try {
        let q = datastore.createQuery(BOAT).limit(3);
        const results = {};
        if (Object.keys(req.query).includes('cursor')) {
            q = q.start(req.query.cursor);
        }
        const entities = await datastore.runQuery(q)
        results.boats = entities[0].map(ds.fromDatastore);
        if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next = ds.createURL(req) + '?cursor=' + entities[1].endCursor;
        }
        return results;
    } catch (err) {
        console.log(err);
    }
}

// Get a single boat from database by id
async function get_boat(id) {
    try {
        const key = datastore.key([BOAT, parseInt(id, 10)]);
        const [boat] = await datastore.get(key);
        return ds.fromDatastore(boat);
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
            let load = await Loads.get_load(boat.loads[l].id);
            load.carrier = null;
            await datastore.update(ds.createEntity(load));
        }
    
        return datastore.delete(boat[ds.Datastore.KEY]);
    } catch (err) {
        console.log(err);
    }   
}

// Put load on boat in the database
async function assign_load_to_boat(boat_id, load_id) {
    try {
        let boat = await get_boat(boat_id);
        let load = await Loads.get_load(load_id);

        if (boat && load) {
            if (load.carrier != null) {
                return FORBIDDEN;
            } else {
                boat.loads.push({"id": load.id, "self": load.self});
                load.carrier = {"id": boat.id, "name": boat.name, "self": boat.self};
                
                await datastore.update(ds.createEntity(boat));
                await datastore.update(ds.createEntity(load));
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
        let load = await Loads.get_load(load_id);
        let boat = await get_boat(boat_id);
        if (load.carrier === null || !boat || !load) {
            return NOT_FOUND;
        } else {
            load.carrier = null;
            let boatLoads = boat.loads.filter( value => value.id != load.id);
            boat.loads = boatLoads;
            
            await datastore.update(ds.createEntity(boat));
            await datastore.update(ds.createEntity(load));

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
            for (let load of boat.loads) {
                const l = await Loads.get_load(load.id);
                loads.push(l);
            }

            return loads;
            
        } else {
            return false;
        }
        
    } catch (err) {
        console.log(err);
    }   
}


/******************************* CONTROLLERS ********************************************/

router.post('/', async (req, res) => {
    if (req.body.name && req.body.type && req.body.length) {
        try {
            const url = ds.createURL(req);
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
router.get('/', async (req, res) => {
    const boats = await get_all_boats(req);
    res.status(OK).json(boats);
});

// READ one boat from database
router.get('/:boat_id', async (req, res) => {
    const boat = await get_boat(req.params.boat_id)
    if (boat) {
        res.status(OK).json(boat);
    } else {
        res.status(NOT_FOUND).json({"Error": "No boat with this boat_id exists"});
    }
});

// DELETE a boat from database
router.delete('/:boat_id', async (req, res) => {
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

// PUT load on boat
router.put('/:boat_id/loads/:load_id', async (req, res) => {
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
router.delete('/:boat_id/loads/:load_id', async (req, res) => {
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
router.get('/:boat_id/loads', async (req, res) => {
    try {
        const loads = await get_boat_loads(req.params.boat_id);
        console.log(loads);
        if (loads) {
            res.status(OK).json({"loads": loads});
        } else {
            res.status(NOT_FOUND).json({"Error": "No boat with this boat_id exists"});
        }
        

    } catch (err) {
        console.log(err);
    }
});


module.exports = router;
