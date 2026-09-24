const router = require('express').Router();
const auth = require('../middleware/auth');
const { adminList, create, update, remove } = require('../controllers/adminProductController');

router.use(auth);
router.get('/', adminList);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
