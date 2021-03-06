let express = require("express");
let router = express.Router();
let passport = require("passport");
let Product = require("../models/product");
var User = require("../models/user");
var Cart = require("../models/cart");
var Order = require("../models/order");
var Review = require("../models/review");
var middleware = require("../middleware/index.js");

var facebookAuth = require("../config/facebook.js")

var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
let csrf = require("csurf");
// {csrfToken: req.csrfToken()}
let csrfProtection = csrf();
router.use(csrfProtection);




//home route
router.get("/", function(req, res) {

     Product.find({}, function(err, prods) {


          if (err) {
               res.render("shop/shop-index-header-fix");
          }
          else {
               // var cart = new Cart(req.session.cart);
               res.render("shop/shop-index-header-fix", { prods: prods });
          }
     });

});


//show register form
router.get("/register", function(req, res) {
     res.render("shop/register", { csrfToken: req.csrfToken() });
});

//hande signup logic
router.post("/register", function(req, res, next) {
     async.waterfall([
          function(done) {
               crypto.randomBytes(20, function(err, buf) {
                    var token = buf.toString('hex');
                    done(err, token);
               });
          },
          function(token, done) {
               var newUser = new User({
                    email: req.body.email,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    contactNumber: req.body.contactNumber,
                    address: req.body.address,
                    emailToken: token
               });

               User.register(newUser, req.body.password, function(err, user) {
                    if (err) {
                         console.log(err);
                         req.flash('error', 'A user with the given username is already registered');
                         return res.render("shop/register", { 'error': 'A user with the given username is already registered' });
                    }
                    done(err, token, user);
               });
          },

          function(token, user, done) {
               var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    auth: {
                         user: 'pitsCarAccessories@gmail.com',
                         pass: process.env.GMAILPW
                    }
               });
               var mailOptions = {
                    to: user.email,
                    from: 'pitsCarAccessories@gmail.com',
                    subject: 'Pit\'s Car Accessories Email Validation',
                    text: 'Your registration at pitscaraccessories.com requires you to validate your email address\n\n' +
                         'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                         'http://' + req.headers.host + '/register/' + token + '\n\n'

               };
               smtpTransport.sendMail(mailOptions, function(err) {
                    console.log('mail sent');
                    req.flash('success', 'An e-mail to validate your account has been sent to ' + user.email + ' \n\n with further instructions. Be sure to check your Spam Folder');
                    done(err, 'done');
               });
          },
          function() {
               res.redirect("/product-list");
          }

     ], function(err) {
          if (err) return next(err);
          res.redirect('/shop/register', { csrfToken: req.csrfToken() });
     });
});

//email validate form
router.get('/register/:token', function(req, res) {
     User.findOne({ emailToken: req.params.token }, function(err, user) {
          if (!user) {
               req.flash('error', 'Token is invalid or has expired.');
               return res.redirect('/forgot');
          }
          res.render('shop/emailValidate', { token: req.params.token, csrfToken: req.csrfToken() });
     });
});

//email validate sets account to active
router.post('/register/:token', function(req, res) {
     async.waterfall([
          function(done) {
               User.findOne({ emailToken: req.params.token }, function(err, user) {

                    user.isActivated = true;
                    user.save();
                    req.flash('success', 'Your Email has been validated. Please log in');
                    res.redirect('/login');
               });
          },
     ], function(err) {
          res.redirect('/');
     });
});


//show login form
router.get("/login", function(req, res) {
     res.render("shop/login", { csrfToken: req.csrfToken() });
});


router.post("/login/login", middleware.sessionMW, function(req, res, next) {
     User.findOne({ email: req.body.email }, function(err, user) {
          if (err) {
               console.log(err);
          }

          if (!user) {
               req.flash("error", "That account does not exist");
               res.redirect("/login");
          }
          else {
               passport.authenticate("local", function(err, user, info) {
                    if (err) {
                         return next(err);
                    }
                    if (!user) {
                         res.redirect("/login");
                    }

                    req.logIn(user, function(err) {
                         if (err) {
                              req.flash("error", err.message);
                              return next(err);
                         }
                         else if (user.isAdmin === true) {
                              res.redirect("/admin");
                         }
                         else if (user.isAdmin === false && user.isActivated === true) {
                              // req.session.cart= req.user.cart;
                              if (!req.session.cart) {
                                   req.session.cart = req.user.cart;
                                   res.redirect("/product-list");
                              }
                              else {
                                   let cart = new Cart(req.session.cart ? req.session.cart : {});
                                   let arrUserCart = [];
                                   for (let id in req.user.cart.items) {
                                        arrUserCart.push(req.user.cart.items[id]);
                                   }

                                   arrUserCart.forEach(function(item) {
                                        Product.findById(item.item._id, function(err, product) {
                                             if (err) {
                                                  console.log(err)
                                             }
                                             else {
                                                  //   console.log(product)
                                                  if (product.quantity <= 0) {
                                                       req.flash("error", "Sorry, This product is not available");
                                                       res.redirect("back");
                                                  }
                                                  else {
                                                       cart.add(product, product._id);
                                                       req.session.cart = cart;
                                                       req.session.save()
                                                  }
                                             }
                                        });
                                   });
                                   req.user.cart = {};
                                   res.redirect("/product-list");
                              }

                         }
                         else {
                              if (user.isAdmin === false && user.isActivated === false) {
                                   req.flash("error", "Your Email has not been validated. Please check your Email");
                                   req.logout();
                                   res.redirect("/login");
                              }
                              else {
                                   req.flash("error", "Wrong Email or Password. Try again");
                                   res.redirect("/login");
                              }
                         }
                    });
               })(req, res, next);
          }
     });

});

//====================
//facebook login
//====================
// Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /auth/facebook/callback
router.get('/auth/facebook', passport.authorize('facebook', { scope: ['email'] }));

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
router.get('/auth/facebook/callback',
     passport.authenticate('facebook', { failureRedirect: '/login' }),
     function(req, res, next) {
          if (req.user.isAdmin === true) {
               res.redirect("/admin");
          }
          else if (req.user.isAdmin === false) {
               if (!req.session.cart) {
                    req.session.cart = req.user.cart;
                    res.redirect("/product-list");
               }
               else {
                    let cart = new Cart(req.session.cart ? req.session.cart : {});
                    let arrUserCart = [];
                    for (let id in req.user.cart.items) {
                         arrUserCart.push(req.user.cart.items[id]);
                    }

                    arrUserCart.forEach(function(item) {
                         Product.findById(item.item._id, function(err, product) {
                              if (err) {
                                   console.log(err)
                              }
                              else {
                                   //   console.log(product)
                                   if (product.quantity <= 0) {
                                        req.flash("error", "Sorry, This product is not available");
                                        res.redirect("back");
                                   }
                                   else {
                                        cart.add(product, product._id);
                                        req.session.cart = cart;
                                        req.session.save()
                                   }
                              }
                         });
                    });
                    req.user.cart = {};
                    res.redirect("/product-list");
               }
          }
     });


//logout route
router.get("/logout", function(req, res) {

     req.user.cart = req.session.cart;
     req.user.save();
     req.session.cart = null;
     // req.user.cart = {};
     req.logout();
     res.redirect("/");
});


//route for user profile
router.get("/profile/:id", middleware.isLoggedIn, middleware.checkProfileOwnership, function(req, res) {
     User.findById(req.params.id, function(err, foundUser) {
          if (err) {
               console.log(err);
          }
          else {
               res.render('shop/shop-account', { foundUser: foundUser, message: req.flash("error") });
          }
     });
     // res.render('shop/shop-account');
});

//profile edit page
router.get("/profile/:id/edit", middleware.isLoggedIn, middleware.checkProfileOwnership, function(req, res) {
     User.findById(req.params.id, function(err, foundUser) {
          if (err) {
               console.log(err);
          }
          else {
               // console.log(foundUser)
               res.render('shop/user-update', { foundUser: foundUser, csrfToken: req.csrfToken() });
          }
     });
});

//profile update page
router.put("/profile/:id", middleware.isLoggedIn, middleware.checkProfileOwnership, function(req, res) {
     User.findByIdAndUpdate(req.params.id, req.body.user, function(err, updatedUser) {
          if (err) {
               console.log(err);
          }
          else {
               res.redirect("/profile/" + req.params.id);
          }
     });
});

//profile address book
router.get("/profile/:id/addressBook", middleware.isLoggedIn, middleware.checkProfileOwnership, function(req, res) {
     User.findById(req.params.id, function(err, foundUser) {
          if (err) {
               req.flash("error", "Something went wrong");
               res.redirect("back");
          }
          else {
               var arr = [];
               // console.log(foundUser.shippingAddress);

               foundUser.shippingAddress.forEach(function(address) {
                    arr.push(address);
                    // console.log(address);
               });
               // console.log(arr);
               res.render("shop/addressBook", { address: arr, csrfToken: req.csrfToken() });

          }
     });
});

//profile orders page
router.get("/profile/:id/orders", middleware.isLoggedIn, function(req, res) {
     Order.find({ user: req.user }, function(err, orders) {
          if (err) {
               return res.write('Error!');
          }

          var cart;
          orders.forEach(function(order) {
               cart = new Cart(order.cart);
               order.items = cart.generateArray();
          });

          res.render('shop/shop-account-orders', { orders: orders.reverse() });
     });
});

//show page for individual item
router.get("/shop-item/:id", function(req, res) {
     Product.findById(req.params.id).populate("reviews").exec(function(err, foundItem) {
          if (err) {
               console.log(err);
               res.redirect("back");
          }
          else {
               res.render("shop/shop-item", { foundItem: foundItem, message: req.flash("error"), csrfToken: req.csrfToken() });
          }
     });
});


// for searching for more than one parameter = Campground.find({$or: [{name: regex,}, {location: regex}, {"author.username":regex}]}, function(err, allCampgrounds){
router.get("/product-list", function(req, res) {

     var perPage = 100;
     var pageQuery = parseInt(req.query.page);
     var pageNumber = pageQuery ? pageQuery : 1;
     var noMatch = null;

     if (req.query.search) {
          const regex = new RegExp(escapeRegex(req.query.search), 'gi');
          Product.find().or([{ name: regex }, { brand: regex }, { type: regex }]).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, prods) {
               Product.countDocuments({ name: regex }).exec(function(err, count) {
                    if (err) {
                         console.log(err);
                         res.redirect("back");
                    }
                    else {
                         if (prods.length <= 0) {
                              noMatch = "No product could match that query, please try again";
                              req.flash("error", "NoThing Found");

                         }
                         res.render("shop/shop-product-list", { prods: prods, current: pageNumber, pages: Math.ceil(count / perPage), "error": noMatch, search: req.query.search });

                    }
               });
          });
     }
     else {
          Product.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, prods) {
               Product.countDocuments().exec(function(err, count) {
                    if (err) {
                         console.log(err);
                    }
                    else {
                         res.render("shop/shop-product-list", { prods: prods, current: pageNumber, pages: Math.ceil(count / perPage), noMatch: noMatch, search: false });
                    }
               });
          });
     }
});


// router.get("/product-list-:type", function(req, res) {
//     Product.find({"type": req.params.type}, function(err, prods) {
//         if (err) {
//             res.render("shop/shop-product-list", {message: req.flash("error")});
//         } else {
//             // var cart = new Cart(req.session.cart);
//             res.render("shop/shop-product-list", {prods: prods, message: req.flash("error") });
//         }
//     }); 
// });

router.get("/product-list-:type", function(req, res) {
     Product.find().or([{ name: req.params.type }, { brand: req.params.type }, { type: req.params.type }]).exec(function(err, prods) {
          if (err) {
               res.render("shop/shop-product-list", { message: req.flash("error") });
          }
          else {
               res.render("shop/shop-product-list", { prods: prods, message: req.flash("error") });
          }
     });
});

//===============================================
//review routes
//================================================


//review create route
router.post("/shop-item/:id/reviews", middleware.isLoggedIn, function(req, res) {
     //look up product
     //create new review
     //connect new review to product
     //redirect back to product show page

     Product.findById(req.params.id, function(err, product) {
          if (err) {
               console.log(err);
               res.redirect("back");
          }
          else {
               Review.create(req.body.review, function(err, review) {
                    if (err) {
                         console.log(err);
                    }
                    else {

                         //add user and user Id to review
                         review.author.id = req.user._id;
                         review.author.name = req.user.firstName + " " + req.user.lastName;
                         review.save();
                         product.reviews.push(review);
                         product.save();
                         res.redirect("/shop-item/" + product._id);
                    }
               });
          }
     });
});

//review update route
router.put("/shop-item/:id/reviews/:review_id", middleware.checkReviewOwnership, function(req, res) {
     Review.findByIdAndUpdate(req.params.review_id, req.body.review, function(err, updatedReview) {
          if (err) {
               console.log(err);
               res.redirect("back");
          }
          else {
               res.redirect("back");
          }
     });
});

//review destroy route
router.delete("/shop-item/:id/reviews/:review_id", middleware.checkReviewOwnership, function(req, res) {
     Review.findByIdAndRemove(req.params.review_id, function(err) {
          if (err) {
               res.redirect("back");
          }
          else {
               res.redirect("back");
          }
     });
});


//===============================================
//forgot password routes
//================================================

router.get("/forgot", function(req, res) {
     res.render("shop/forgotPS", { message: req.flash("error"), csrfToken: req.csrfToken() });
});

router.post('/forgot', function(req, res, next) {
     async.waterfall([
          function(done) {
               crypto.randomBytes(20, function(err, buf) {
                    var token = buf.toString('hex');
                    done(err, token);
               });
          },
          //don't need this for signing up logic start don't need an expiring token as well
          function(token, done) {
               User.findOne({ email: req.body.email }, function(err, user) {
                    if (!user) {
                         req.flash('error', 'No account with that email address exists.');
                         return res.redirect('/forgot');
                    }

                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                    user.save(function(err) {
                         done(err, token, user);
                    });
               });
          },
          //don't need this for signing up logic end
          function(token, user, done) {
               var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    auth: {
                         user: 'pitsCarAccessories@gmail.com',
                         pass: process.env.GMAILPW
                    }
               });
               var mailOptions = {
                    to: user.email,
                    from: 'pitsCarAccessories@gmail.com',
                    subject: 'Pit\'s Car Accessories Password Reset',
                    text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                         'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                         'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                         'If you did not request this, please ignore this email and your password will remain unchanged.\n'
               };
               smtpTransport.sendMail(mailOptions, function(err) {
                    console.log('mail sent');
                    req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions. Be sure to check your Spam Folder');
                    done(err, 'done');
               });
          }
     ], function(err) {
          if (err) return next(err);
          res.redirect('/forgot');
     });
});

// might not need this one too start
router.get('/reset/:token', function(req, res) {
     User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
          if (!user) {
               req.flash('error', 'Password reset token is invalid or has expired.');
               return res.redirect('/forgot');
          }
          res.render('shop/resetPS', { token: req.params.token, csrfToken: req.csrfToken() });
     });
});
// might not need this one too start

router.post('/reset/:token', function(req, res) {
     async.waterfall([
          function(done) {
               User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
                    if (!user) {
                         req.flash('error', 'Password reset token is invalid or has expired.');
                         return res.redirect('back');
                    }
                    if (req.body.password === req.body.confirm) {
                         user.setPassword(req.body.password, function(err) {
                              user.resetPasswordToken = undefined;
                              user.resetPasswordExpires = undefined;

                              user.save(function(err) {
                                   req.logIn(user, function(err) {
                                        done(err, user);
                                   });
                              });
                         });
                    }
                    else {
                         req.flash("error", "Passwords do not match.");
                         return res.redirect('back');
                    }
               });
          },
          function(user, done) {
               var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    auth: {
                         user: 'pitsCarAccessories@gmail.com',
                         pass: process.env.GMAILPW
                    }
               });
               var mailOptions = {
                    to: user.email,
                    from: 'pitsCarAccessories@gmail.com',
                    subject: 'Your password has been changed',
                    text: 'Hello,\n\n' +
                         'This is a confirmation that the password for your account ' + user.email + ' at Pit\' Car Accessories\' website has just been changed.\n'
               };
               smtpTransport.sendMail(mailOptions, function(err) {
                    req.flash('success', 'Success! Your password has been changed.');
                    done(err);
               });
          }
     ], function(err) {
          res.redirect('/');
     });
});


router.get("/shippingAddress", function(req, res) {
     res.render("shop/shippingAddress", { csrfToken: req.csrfToken() });
});


router.post("/shippidingAddress/:id", function(req, res) {
     User.findById(req.params.id, function(err, user) {
          if (err) {
               req.flash("error", "something went wrong");
               res.redirect("back");
          }
          else {

               if (user.shippingAddress.length === 0) {
                    user.shippingAddress.push({
                         fullName: req.body.fullName,
                         contactNumber: req.body.contactNumber,
                         address: req.body.address,
                         defaultAddress: true,
                    });
               }
               else {
                    user.shippingAddress.push({
                         fullName: req.body.fullName,
                         contactNumber: req.body.contactNumber,
                         address: req.body.address
                    });
               }
               user.save();
               res.redirect("back");
          }
     });
});

//make default address
router.get("/makeDefaultShippingAddress/:id/:addressId", function(req, res) {
     User.findById(req.params.id, function(err, foundUser) {
          if (err) {
               req.flash("error", "something went wrong");
               res.redirect("/profile/" + req.params.id + "/addressBook");
          }
          else {
               foundUser.shippingAddress.forEach(function(address) {
                    if (address._id == req.params.addressId) {
                         address.defaultAddress = true;
                    }
                    else {
                         address.defaultAddress = false;
                    }
                    // address.defaultAddress = false;
               });

               //put default address on top of the array
               // for (var x = 0; x < foundUser.shippingAddress.length; x++) {
               //    if (foundUser.shippingAddress[x].defaultAddress == true) {

               //           foundUser.shippingAddress.unshift(foundUser.shippingAddress[x])
               //           foundUser.shippingAddress.pop(foundUser.shippingAddress[x])

               //    }
               // }
               foundUser.save();
               res.redirect("/profile/" + req.params.id + "/addressBook");
          }
     });
});

//remove shipping address
router.get("/makeDefaultShippingAddress/:id/remove/:addressId", function(req, res) {
     User.findById(req.params.id, function(err, foundUser) {
          if (err) {
               req.flash("error", "something went wrong");
               res.redirect("/profile/" + req.params.id + "/addressBook");
          }
          else {
               for (var x = 0; x < foundUser.shippingAddress.length; x++) {
                    //    console.log(foundUser.shippingAddress[x]._id)
                    if (foundUser.shippingAddress[x]._id == req.params.addressId) {
                         console.log(foundUser.shippingAddress[x]._id)
                         //    console.log(req.params.addressId)
                         foundUser.shippingAddress.pop(foundUser.shippingAddress[x])
                    }
               }
               console.log(foundUser.shippingAddress.length);
               foundUser.save();
               res.redirect("/profile/" + req.params.id + "/addressBook");
          }
     });
});


//function for protection from regex attacks
function escapeRegex(text) {
     return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}
module.exports = router;