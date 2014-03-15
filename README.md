##jQuery Bindings for [GopherJS](http://github.com/gopherjs/gopherjs) 

## Install

    $ go get github.com/gopherjs/jquery

### How To Use

welcome.html file:
```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Welcome to GopherJS with jQuery</title>
    <script src="resources/jquery-2.1.0.js"></script>
</head>
<body>
    <input id="name" type="text" value="" placeholder="What is your name ?" autofocus/>
    <span id="output"></span>
    <script src="welcome.js"></script>
</body>
</html>
```

welcome.go file:

```go
package main

import "github.com/gopherjs/jquery"

//convenience:
var jQuery = jquery.NewJQuery

const (
	INPUT  = "input#name"
	OUTPUT = "span#output"
)

func main() {

	//show jQuery Version on console:
	print("Your current jQuery version is: " + jQuery().Jquery)

	//catch keyup events on input#name element:
	jQuery(INPUT).On(jquery.KEYUP, func(e jquery.Event) {

		name := jQuery(e.Target).Val()
		name = jquery.Trim(name)

		//show welcome message:
		if len(name) > 0 {
			jQuery(OUTPUT).SetText("Welcome to GopherJS, " + name + " !")
		} else {
			jQuery(OUTPUT).Empty()
		}
	})
}
```

Compile welcome.go:

    $ gopherjs build welcome.go
    

### Sample Apps ported from Javascript/Coffeescript to GopherJS 
	
Look at the Sample Apps to find out what is working and how. Any feedback is welcome !

- TodoMVC :  	the canonical jQuery Version
- Flappy Math : teach your kids the multiplication tables
- Tabata Timer: Get in Shape with GopherJS
- QUnit Tests:	Don't bet on this, I am not sure wheter I will switch to golangs Idiomatic Testing facilities 

### Status

The normal DOM Api is in place, still on the Todo List are:

- Ajax API (ongoing)
- Promises/Deferreds
- More Docs



