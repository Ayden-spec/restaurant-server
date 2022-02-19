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
                token
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
                token
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

router.get('/product-id/:id', async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT products.* FROM products WHERE product_id = '${req.params.id}'`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(404).json({ message: "404 NOT FOUND" });
            }
            return res.json({
                product: rows[0]
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

router.post('/product-add/:product_id', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                mysqls.executeQuery(`INSERT INTO basket (product_id, user_id, value) VALUES ('${req.params.product_id}', '${req.user.id}', 1)`)
            }
            return res.json({ message: 'Товар успешно добален!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})


router.put('/product-plus/:product_id', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                mysqls.executeQuery(`INSERT INTO basket (product_id, user_id, value) VALUES ('${req.params.product_id}', '${req.user.id}', 1)`)
            } else {
                mysqls.executeQuery(`UPDATE basket SET basket.value = basket.value + 1 WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}'`)
            }
            return res.json({ message: 'Товар успешно добален!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.put('/product-minus/:product_id', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Товар не найден!" })
            } else {
                if (rows[0].value === 1) {
                    mysqls.executeQuery(`DELETE FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}'`)
                } else {
                    mysqls.executeQuery(`UPDATE basket SET basket.value = basket.value - 1 WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}'`)
                }
            }
            return res.json({ message: 'Предмет успешно убран!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.delete('/product-delete/:product_id', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT basket.* FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Товар не найден!" })
            }
            mysqls.executeQuery(`DELETE FROM basket WHERE basket.product_id = '${req.params.product_id}' AND basket.user_id = '${req.user.id}'`)
            return res.json({ message: 'Предмет успешно удален!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.get('/get-basket', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT basket.value AS basket, products.product_id, products.name, products.description, products.price, products.image FROM basket, products WHERE products.product_id = basket.product_id AND basket.user_id = '${req.user.id}'`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Товар не найден!" })
            }
            return res.json({ basket: rows })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})


router.put('/update-user-info', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT users.* FROM users WHERE users.id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Пользователь не найден!" })
            } else {
                mysqls.executeQuery(`UPDATE users SET name='${req.body.name}', number='${req.body.number}', street='${req.body.street}', house_number='${req.body.house_number}', apartment_number='${req.body.apartment_number}', entrance='${req.body.entrance}', floor='${req.body.floor}' WHERE users.id = '${req.user.id}'`)
                mysqls.executeQuery(`DELETE FROM basket WHERE basket.user_id = '${req.user.id}'`)
            }
            return res.json({ message: 'Данные успешно обновлены!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.post('/add-order', async (req, res) => {
    try {
        if (req.body.basket.length === 0) {
            return res.status(400).json({ message: "Корзина пуста" })
        }
        mysqls.executeQuery(`SELECT orders.* FROM orders WHERE orders.phone_number='${req.body.phone_number}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                mysqls.executeQuery(`INSERT INTO orders (phone_number, name, delivery_type, street, house_number, apartment_number, entrance, floor, comment, 
                payment_type, cash_change, when_deliver_type, number_persons, time_delivery, checkbox_call, time) 
                VALUES ('${req.body.phone_number}', '${req.body.name}', '${req.body.delivery_type}', '${req.body.street}', '${req.body.house_number}', 
                '${req.body.apartment_number}', '${req.body.entrance}', '${req.body.floor}', '${req.body.comment}', '${req.body.payment_type}', 
                '${req.body.cash_change}', '${req.body.when_deliver_type}', '${req.body.number_persons}', '${req.body.time_delivery}', '${req.body.call}', NOW())`);
                req.body.basket.forEach(element => {
                    mysqls.executeQuery(`INSERT INTO orders_products (phone_number, product_id, value) VALUES ('${req.body.phone_number}', '${element.product_id}', '${element.basket}')`)
                });
            } else {
                mysqls.executeQuery(`DELETE FROM orders_products WHERE orders_products.phone_number = '${req.body.phone_number}'`)
                mysqls.executeQuery(`UPDATE orders SET name='${req.body.name}', delivery_type='${req.body.delivery_type}', street='${req.body.street}', house_number='${req.body.house_number}', 
                apartment_number='${req.body.apartment_number}', entrance='${req.body.entrance}', floor='${req.body.floor}', comment='${req.body.comment}', payment_type='${req.body.payment_type}',
                cash_change='${req.body.cash_change}', when_deliver_type='${req.body.when_deliver_type}', number_persons='${req.body.number_persons}', time_delivery='${req.body.time_delivery}' ,
                checkbox_call='${req.body.call}', time='${req.body.time}', time = NOW() WHERE orders.phone_number='${req.body.phone_number}'`);
                req.body.basket.forEach(element => {
                    mysqls.executeQuery(`INSERT INTO orders_products (phone_number, product_id, value) VALUES ('${req.body.phone_number}', '${element.product_id}', '${element.basket}')`)
                });
            }
            return res.json({ message: 'Заказ оформлен!!' })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

router.get('/get-user-info', authMidleware, async (req, res) => {
    try {
        mysqls.executeQuery(`SELECT * FROM users WHERE id = '${req.user.id}' LIMIT 1`, function (err, rows, fields) {
            if (err) {
                console.log('[DATABASE | ERROR] ' + err);
                return;
            }
            if (rows.length === 0) {
                return res.status(400).json({ message: "Пользователь не найден." })
            }
            return res.json({
                name: rows[0].name,
                number: rows[0].number,
                street: rows[0].street,
                house_number: rows[0].house_number,
                apartment_number: rows[0].apartment_number,
                entrance: rows[0].entrance,
                floor: rows[0].floor
            })
        });
    } catch (e) {
        console.log(e);
        res.send({ message: "server error" })
    }
})

module.exports = router;