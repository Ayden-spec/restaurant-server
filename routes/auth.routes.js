const Routes = require('express');
const mysqls = require('../modules/mysql')
const { check, validationResult } = require('express-validator')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const config = require('config')
const authMidleware = require('./auth.midleware')
const router = new Routes();

router.post('/registration',
    [
        check('email', 'Некорректный email.').isEmail(),
        check('password', 'Длина пароля должна быть не менее 6 символов.').isLength({ min: 6, max: 15 })
    ], async (req, res) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return (res.status(400).json({ message: 'Uncorrect request', errors }))
            }
            const { email, password, name } = req.body
            const hashPass = await bcrypt.hash(password, 5);
            mysqls.executeQuery(`SELECT * FROM users WHERE email = '${email}' LIMIT 1`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    let sql = "INSERT INTO users (email, name, password) VALUES ('" + email + "', '" + name + "', '" + hashPass + "')";
                    mysqls.executeQuery(sql)
                    res.json({ message: "Вы успешно зарегестрировались." })
                } else if (rows[0].email === email) {
                    res.status(400).json({ message: "Данный email: " + email + " занят." })
                }
            });
        } catch (e) {
            console.log(e);
            res.send({ message: "server error" })
        }
    })


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        mysqls.executeQuery(`SELECT * FROM users WHERE email = '${email}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }

            if (rows.length === 0) {
                return res.status(400).json({ message: "Пользователь не найден." })
            }

            if (!bcrypt.compareSync(password, rows[0].password)) {
                return res.status(400).json({ message: "Неправильный пароль или логин." })
            }

            const token = jwt.sign({ id: rows[0].id }, config.get("secret_key"), { expiresIn: "1h" })
            return res.json({
                token,
                user: {
                    id: rows[0].id,
                    email: rows[0].email
                }
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.get('/auth', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT * FROM users WHERE id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Пользователь не найден." })
            }
            const token = jwt.sign({ id: rows[0].id }, config.get("secret_key"), { expiresIn: "1h" })
            return res.json({
                token,
                user: {
                    id: rows[0].id,
                    email: rows[0].email
                }
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.get('/', async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT categories.* FROM categories ORDER BY category_name`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Категории не найдены" })
            }
            let categories = rows;
            mysqls.executeQuery(`SELECT categories_products.category_id, products.* FROM categories_products JOIN products ON categories_products.product_id = products.product_id`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    return res.status(400).json({ message: "404 NOT FOUND" })
                }
                let products = rows;
                return res.json({
                    categories,
                    products
                })
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})


router.get('/recomandation', async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT products.* FROM recommendations, products WHERE recommendations.product_id = products.product_id`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "404 NOT FOUND" })
            }
            return res.json({
                recommendations: rows
            })
        })
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/product-id', async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT products.* FROM products WHERE product_id = '${req.body.id}'`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(404).json({ message: "404 NOT FOUND" });
            }
            let product = rows[0];
            if (req.body.token) {
                const decoded = jwt.verify(req.body.token, config.get('secret_key'));
                var sql = `SELECT products.*, basket.value AS basket FROM recommendations JOIN products ON products.product_id = recommendations.product_id LEFT OUTER JOIN basket ON basket.product_id = recommendations.product_id AND basket.user_id = '${decoded.id}'`
            } else {
                var sql = `SELECT products.* FROM recommendations JOIN products ON products.product_id = recommendations.product_id`
            }
            mysqls.executeQuery(sql, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    return res.status(400).json({ message: "404 NOT FOUND" })
                }
                let recommendations = rows
                return res.json({
                    product,
                    recommendations
                })
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})


router.get('/promotion', async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT promotion.* FROM promotion`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(404).json({ message: "404 NOT FOUND" });
            }
            return res.json({
                promotion: rows
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/product-add', async (req, res) => {
    try {
        if (req.body.token) {
            const decoded = jwt.verify(req.body.token, config.get('secret_key'));
            mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}' LIMIT 1`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    mysqls.executeQuery(`INSERT INTO basket (product_id, user_id, value) VALUES ('${req.body.product_id}', '${decoded.id}', 1)`)
                }
                return res.json({ message: 'Товар успешно добален!' })
            });
        } else {
            return res.status(400).json({ message: "Вы не авторизованы!" })
        }
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})


router.post('/product-plus', async (req, res) => {
    try {
        if (req.body.token) {
            const decoded = jwt.verify(req.body.token, config.get('secret_key'));
            mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}' LIMIT 1`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    mysqls.executeQuery(`INSERT INTO basket (product_id, user_id, value) VALUES ('${req.body.product_id}', '${decoded.id}', 1)`)
                } else {
                    mysqls.executeQuery(`UPDATE basket SET basket.value = basket.value + 1 WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}'`)
                }
                return res.json({ message: 'Товар успешно добален!' })
            });
        } else {
            return res.status(400).json({ message: "Вы не авторизованы!" })
        }
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/product-minus', async (req, res) => {
    try {
        if (req.body.token) {
            const decoded = jwt.verify(req.body.token, config.get('secret_key'));
            mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}' LIMIT 1`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    return res.status(400).json({ message: "Товар не найден!" })
                } else {
                    if (rows[0].value === 1) {
                        mysqls.executeQuery(`DELETE FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}'`)
                    } else {
                        mysqls.executeQuery(`UPDATE basket SET basket.value = basket.value - 1 WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}'`)
                    }
                }
                return res.json({ message: 'Предмет успешно убран!' })
            });
        } else {
            return res.status(400).json({ message: "Вы не авторизованы!" })
        }
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/product-delete', async (req, res) => {
    try {
        if (req.body.token) {
            const decoded = jwt.verify(req.body.token, config.get('secret_key'));
            mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}' LIMIT 1`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    return res.status(400).json({ message: "Товар не найден!" })
                }
                mysqls.executeQuery(`DELETE FROM basket WHERE basket.product_id = '${req.body.product_id}' AND basket.user_id = '${decoded.id}'`)
                return res.json({ message: 'Предмет успешно удален!' })
            });
        } else {
            return res.status(400).json({ message: "Вы не авторизованы!" })
        }
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/get-basket', async (req, res) => {
    try {
        if (req.body.token) {
            const decoded = jwt.verify(req.body.token, config.get('secret_key'));
            mysqls.executeQuery(`SELECT basket.value AS basket, products.product_id, products.name, products.description, products.price, products.image FROM basket, products WHERE products.product_id = basket.product_id AND basket.user_id = '${decoded.id}'`, function (err, rows, fields) {
                if (err) {
                    console.log('[DATABASE | ERROR] ' + err);
                    return;
                }
                if (rows.length === 0) {
                    return res.status(400).json({ message: "Товар не найден!" })
                }
                return res.json({ basket: rows })
            });
        } else {
            return res.status(400).json({ message: "Вы не авторизованы!" })
        }
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

module.exports = router;