package test

//test package for jquery bindings, developed in TDD style
import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/rusco/jquery"
	QUnit "github.com/rusco/qunit"
	"strconv"
	"strings"
	"time"
)

const (
	FIX = "#qunit-fixture"
)

var jQuery = jquery.NewJQuery //convenience

func getDocumentBody() js.Object {
	return js.Global.Get("document").Get("body")
}

func getWindow() js.Object {
	return js.Global
}

type EvtScenario struct{}

func (s EvtScenario) Setup() {
	jQuery(`<p id="firstp">See 
			<a id="someid" href="somehref" rel="bookmark">this blog entry</a>
			for more information.</p>`).AppendTo(FIX)
}
func (s EvtScenario) Teardown() {
	jQuery(FIX).Empty()
}

func main() {

	QUnit.Module("jquery core")
	QUnit.Test("jQuery Properties", func(assert QUnit.QUnitAssert) {

		assert.Equal(jQuery().Jquery, "2.1.0", "JQuery Version")
		assert.Equal(jQuery().Length, 0, "jQuery().Length")

		jQ2 := jQuery("body")
		assert.Equal(jQ2.Selector, "body", `jQ2 := jQuery("body"); jQ2.Selector.Selector`)
		assert.Equal(jQuery("body").Selector, "body", `jQuery("body").Selector`)
	})

	QUnit.Test("Test Setup", func(assert QUnit.QUnitAssert) {

		test := jQuery(getDocumentBody()).Find(FIX)
		assert.Equal(test.Selector, FIX, "#qunit-fixture find Selector")
		assert.Equal(test.Context, getDocumentBody(), "#qunit-fixture find Context")
	})

	QUnit.Test("Static Functions", func(assert QUnit.QUnitAssert) {

		jquery.GlobalEval("var globalEvalTest = 2;")
		assert.Equal(js.Global.Get("globalEvalTest").Int(), 2, "GlobalEval: Test variable declarations are global")

		assert.Equal(jquery.Trim("  GopherJS  "), "GopherJS", "Trim: leading and trailing space")

		assert.Equal(jquery.Type(true), "boolean", "Type: Boolean")
		assert.Equal(jquery.Type(time.Now()), "date", "Type: Date")
		assert.Equal(jquery.Type("GopherJS"), "string", "Type: String")
		assert.Equal(jquery.Type(12.21), "number", "Type: Number")
		assert.Equal(jquery.Type(nil), "null", "Type: Null")
		assert.Equal(jquery.Type([2]string{"go", "lang"}), "array", "Type: Array")
		assert.Equal(jquery.Type([]string{"go", "lang"}), "array", "Type: Array")
		o := map[string]interface{}{"a": true, "b": 1.1, "c": "more"}
		assert.Equal(jquery.Type(o), "object", "Type: Object")
		assert.Equal(jquery.Type(getDocumentBody), "function", "Type: Function")

		assert.Ok(!jquery.IsPlainObject(""), "IsPlainObject: string")
		assert.Ok(jquery.IsPlainObject(o), "IsPlainObject: Object")
		assert.Ok(!jquery.IsEmptyObject(o), "IsEmptyObject: Object")
		assert.Ok(jquery.IsEmptyObject(map[string]interface{}{}), "IsEmptyObject: Object")

		assert.Ok(!jquery.IsFunction(""), "IsFunction: string")
		assert.Ok(jquery.IsFunction(getDocumentBody), "IsFunction: getDocumentBody")

		assert.Ok(!jquery.IsNumeric("a3a"), "IsNumeric: string")
		assert.Ok(jquery.IsNumeric("0xFFF"), "IsNumeric: hex")
		assert.Ok(jquery.IsNumeric("8e-2"), "IsNumeric: exponential")

		assert.Ok(!jquery.IsXMLDoc(getDocumentBody), "HTML Body element")
		assert.Ok(jquery.IsWindow(getWindow()), "window")

	})

	QUnit.Test("ToArray,InArray", func(assert QUnit.QUnitAssert) {

		jQuery(`<div>a</div>
				<div>b</div>
				<div>c</div>`).AppendTo(FIX)

		divs := jQuery(FIX).Find("div")
		assert.Equal(divs.Length, 3, "3 divs in Fixture inserted")

		str := ""
		for _, v := range divs.ToArray() {
			str += jQuery(v).Text()
		}
		assert.Equal(str, "abc", "ToArray() allows range over selection")

		arr := []interface{}{"a", 3, true, 2.2, "GopherJS"}
		assert.Equal(jquery.InArray(4, arr), -1, "InArray")
		assert.Equal(jquery.InArray(3, arr), 1, "InArray")
		assert.Equal(jquery.InArray("a", arr), 0, "InArray")
		assert.Equal(jquery.InArray("b", arr), -1, "InArray")
		assert.Equal(jquery.InArray("GopherJS", arr), 4, "InArray")

	})

	QUnit.Test("ParseHTML, ParseXML, ParseJSON", func(assert QUnit.QUnitAssert) {

		str := `<ul>
  				<li class="firstclass">list item 1</li>
  				<li>list item 2</li>
  				<li>list item 3</li>
  				<li>list item 4</li>
  				<li class="lastclass">list item 5</li>
				</ul>`

		arr := jquery.ParseHTML(str)
		jQuery(arr).AppendTo(FIX)
		assert.Equal(jQuery(FIX).Find("ul li").Length, 5, "ParseHTML")

		xml := "<rss version='2.0'><channel><title>RSS Title</title></channel></rss>"
		xmlDoc := jquery.ParseXML(xml)
		assert.Equal(jQuery(xmlDoc).Find("title").Text(), "RSS Title", "ParseXML")

		obj := jquery.ParseJSON(`{ "language": "go" }`)
		language := obj.(map[string]interface{})["language"].(string)
		assert.Equal(language, "go", "ParseJSON")

	})

	QUnit.Test("Grep,Each,Map", func(assert QUnit.QUnitAssert) {

		arr := []interface{}{1, 9, 3, 8, 6, 1, 5, 9, 4, 7, 3, 8, 6, 9, 1}
		arr2 := jquery.Grep(arr, func(n interface{}, idx int) bool {
			return n.(float64) != float64(5) && idx > 4
		})
		assert.Equal(len(arr2), 9, "Grep")

		sum := float64(0.0)
		jquery.EachOverArray(arr, func(idx int, n interface{}) bool {
			sum += n.(float64)
			return idx < 5 //add first 5 numbers
		})
		assert.Equal(sum, 28, "EachOverArray")

		allLanguages := ""
		o := map[string]interface{}{"lang1": "Golang", "lang2": "Javascript", "lang3": "Typescript"}
		jquery.EachOverMap(o, func(key string, val interface{}) bool {
			allLanguages += val.(string)
			return true //add all
		})
		assert.Equal(allLanguages, "GolangJavascriptTypescript", "EachOverMap")

		letterArr := []interface{}{"a", "b", "c", "d", "e"}
		resultArr := jquery.MapOverArray(letterArr, func(n interface{}, idx int) interface{} {
			return strings.ToUpper(n.(string)) + strconv.Itoa(idx)
		})
		allLetters := ""
		for _, val := range resultArr {
			allLetters += val.(string)
		}
		assert.Equal(allLetters, "A0B1C2D3E4", "MapOverArray")

		upperLanguages := jquery.MapOverMap(o, func(val interface{}, key string) interface{} {
			return strings.ToUpper(val.(string))
		})
		allUpperLanguages := ""
		for _, val := range upperLanguages {
			allUpperLanguages += val.(string)
		}
		assert.Equal(allUpperLanguages, "GOLANGJAVASCRIPTTYPESCRIPT", "MapOverMap")

	})

	QUnit.Test("Noop,Now", func(assert QUnit.QUnitAssert) {

		callSth := func(fn func() interface{}) interface{} {
			return fn()
		}
		_ = callSth(jquery.Noop)
		_ = jquery.Noop()
		assert.Ok(jquery.IsFunction(jquery.Noop), "jquery.Noop")

		date := js.Global.Get("Date").New()
		time := date.Call("getTime").Float()

		assert.Ok(time <= jquery.Now(), "jquery.Now()")
	})

	QUnit.Module("dom")
	QUnit.Test("AddClass,Clone,Add,AppendTo,Find", func(assert QUnit.QUnitAssert) {

		jQuery("p").AddClass("wow").Clone().Add("<span id='dom02'>WhatADay</span>").AppendTo(FIX)
		txt := jQuery(FIX).Find("span#dom02").Text()
		assert.Equal(txt, "WhatADay", "Test of Clone, Add, AppendTo, Find, Text Functions")

		jQuery(FIX).Empty()

		html := `
			<div>This div should be white</div>
			<div class="red">This div will be green because it now has the "green" and "red" classes.
			   It would be red if the addClass function failed.</div>
			<div>This div should be white</div>
			<p>There are zero green divs</p>

			<button>some btn</button>`
		jQuery(html).AppendTo(FIX)
		jQuery(FIX).Find("div").AddClass(func(index int, currentClass string) string {

			addedClass := ""
			if currentClass == "red" {
				addedClass = "green"
				jQuery("p").SetText("There is one green div")
			}
			return addedClass
		})
		jQuery(FIX).Find("button").AddClass("red")
		assert.Ok(jQuery(FIX).Find("button").HasClass("red"), "button hasClass red")
		assert.Ok(jQuery(FIX).Find("p").Text() == "There is one green div", "There is one green div")
		assert.Ok(jQuery(FIX).Find("div:eq(1)").HasClass("green"), "one div hasClass green")
		jQuery(FIX).Empty()

	})
	QUnit.Test("Children,Append", func(assert QUnit.QUnitAssert) {

		var j = jQuery(`<div class="pipe animated"><div class="pipe_upper" style="height: 79px;"></div><div class="guess top" style="top: 114px;"></div><div class="pipe_middle" style="height: 100px; top: 179px;"></div><div class="guess bottom" style="bottom: 76px;"></div><div class="pipe_lower" style="height: 41px;"></div><div class="question"></div></div>`)
		assert.Ok(len(j.Html()) == 301, "jQuery html len")

		j.Children(".question").Append(jQuery(`<div class = "question_digit first" style = "background-image: url('assets/font_big_3.png');"></div>`))
		assert.Ok(len(j.Html()) == 397, "jquery html len after 1st jquery object append")

		j.Children(".question").Append(jQuery(`<div class = "question_digit symbol" style="background-image: url('assets/font_shitty_x.png');"></div>`))
		assert.Ok(len(j.Html()) == 497, "jquery htm len after 2nd jquery object append")

		j.Children(".question").Append(`<div class = "question_digit second" style = "background-image: url('assets/font_big_1.png');"></div>`)
		assert.Ok(len(j.Html()) == 594, "jquery html len after html append")

	})

	QUnit.Test("ApiOnly:ScollFn,SetCss,CssArray,FadeOut", func(assert QUnit.QUnitAssert) {

		//QUnit.Expect(0)
		for i := 0; i < 3; i++ {
			jQuery("p").Clone().AppendTo(FIX)
		}
		jQuery(FIX).Scroll(func(e jquery.Event) {
			jQuery("span").SetCss("display", "inline").FadeOut("slow")
		})

		htmlsnippet := `<style>
			  div {
			    height: 50px;
			    margin: 5px;
			    padding: 5px;
			    float: left;
			  }
			  #box1 {
			    width: 50px;
			    color: yellow;
			    background-color: blue;
			  }
			  #box2 {
			    width: 80px;
			    color: rgb(255, 255, 255);
			    background-color: rgb(15, 99, 30);
			  }
			  #box3 {
			    width: 40px;
			    color: #fcc;
			    background-color: #123456;
			  }
			  #box4 {
			    width: 70px;
			    background-color: #f11;
			  }
			  </style>
			 
			<p id="result">&nbsp;</p>
			<div id="box1">1</div>
			<div id="box2">2</div>
			<div id="box3">3</div>
			<div id="box4">4</div>`

		jQuery(htmlsnippet).AppendTo(FIX)

		jQuery(FIX).Find("div").On("click", func() {

			html := []string{"The clicked div has the following styles:"}
			var styleProps = jQuery(js.This).CssArray("width", "height")
			for prop, value := range styleProps {
				html = append(html, prop+": "+value.(string))
			}
			jQuery(FIX).Find("#result").SetHtml(strings.Join(html, "<br>"))
		})
		jQuery(FIX).Find("div:eq(0)").Trigger("click")
		assert.Ok(jQuery(FIX).Find("#result").Html() == "The clicked div has the following styles:<br>width: 50px<br>height: 50px", "CssArray read properties")

	})

	QUnit.Test("ApiOnly:SelectFn,SetText,Show,FadeOut", func(assert QUnit.QUnitAssert) {

		QUnit.Expect(0)
		jQuery(`<p>Click and drag the mouse to select text in the inputs.</p>
  				<input type="text" value="Some text">
  				<input type="text" value="to test on">
  				<div></div>`).AppendTo(FIX)

		jQuery(":input").Select(func(e jquery.Event) {
			jQuery("div").SetText("Something was selected").Show().FadeOut("1000")
		})
	})

	QUnit.Test("Eq,Find", func(assert QUnit.QUnitAssert) {

		jQuery(`<div></div>
				<div></div>
				<div class="test"></div>
				<div></div>
				<div></div>
				<div></div>`).AppendTo(FIX)

		assert.Ok(jQuery(FIX).Find("div").Eq(2).HasClass("test"), "Eq(2) has class test")
		assert.Ok(!jQuery(FIX).Find("div").Eq(0).HasClass("test"), "Eq(0) has no class test")
	})

	QUnit.Test("Find,End", func(assert QUnit.QUnitAssert) {

		jQuery(`<p class='ok'><span class='notok'>Hello</span>, how are you?</p>`).AppendTo(FIX)

		assert.Ok(jQuery(FIX).Find("p").Find("span").HasClass("notok"), "before call to end")
		assert.Ok(jQuery(FIX).Find("p").Find("span").End().HasClass("ok"), "after call to end")
	})

	QUnit.Test("Slice,Attr,First,Last", func(assert QUnit.QUnitAssert) {

		jQuery(`<ul>
  				<li class="firstclass">list item 1</li>
  				<li>list item 2</li>
  				<li>list item 3</li>
  				<li>list item 4</li>
  				<li class="lastclass">list item 5</li>
				</ul>`).AppendTo(FIX)

		assert.Equal(jQuery(FIX).Find("li").Slice(2).Length, 3, "Slice")
		assert.Equal(jQuery(FIX).Find("li").Slice(2, 4).Length, 2, "SliceByEnd")

		assert.Equal(jQuery(FIX).Find("li").First().Attr("class"), "firstclass", "First")
		assert.Equal(jQuery(FIX).Find("li").Last().Attr("class"), "lastclass", "Last")

	})

	QUnit.Test("Css", func(assert QUnit.QUnitAssert) {

		jQuery(FIX).SetCss(map[string]interface{}{"color": "red", "background": "blue", "width": "20px", "height": "10px"})
		assert.Ok(jQuery(FIX).Css("width") == "20px" && jQuery(FIX).Css("height") == "10px", "SetCssMap")

		div := jQuery("<div style='display: inline'/>").Show().AppendTo(FIX)
		assert.Equal(div.Css("display"), "inline", "Make sure that element has same display when it was created.")
		div.Remove()

		span := jQuery("<span/>").Hide().Show()
		assert.Equal(span.Get(0).Get("style").Get("display"), "inline", "For detached span elements, display should always be inline")
		span.Remove()

	})

	QUnit.Test("Attributes", func(assert QUnit.QUnitAssert) {

		jQuery("<form id='testForm'></form>").AppendTo(FIX)
		extras := jQuery("<input id='id' name='id' /><input id='name' name='name' /><input id='target' name='target' />").AppendTo("#testForm")
		assert.Equal(jQuery("#testForm").Attr("target"), "", "Attr")
		assert.Equal(jQuery("#testForm").SetAttr("target", "newTarget").Attr("target"), "newTarget", "SetAttr2")
		assert.Equal(jQuery("#testForm").RemoveAttr("id").Attr("id"), "", "RemoveAttr ")
		assert.Equal(jQuery("#testForm").Attr("name"), "", "Attr undefined")
		extras.Remove()

		jQuery("<a/>").SetAttr(map[string]interface{}{"id": "tAnchor5", "href": "#5"}).AppendTo(FIX)
		assert.Equal(jQuery("#tAnchor5").Attr("href"), "#5", "Attr")
		jQuery("<a id='tAnchor6' href='#5' />").AppendTo(FIX)
		assert.Equal(jQuery("#tAnchor5").Prop("href"), jQuery("#tAnchor6").Prop("href"), "Prop")

		input := jQuery("<input name='tester' />")
		assert.StrictEqual(input.Clone(true).SetAttr("name", "test").Underlying().Index(0).Get("name"), "test", "Clone")

		jQuery(FIX).Empty()

		jQuery(`<input type="checkbox" checked="checked">
  			<input type="checkbox">
  			<input type="checkbox">
  			<input type="checkbox" checked="checked">`).AppendTo(FIX)

		jQuery(FIX).Find("input[type='checkbox']").SetProp("disabled", true)
		assert.Ok(jQuery(FIX).Find("input[type='checkbox']").Prop("disabled"), "SetProp")

	})

	QUnit.Test("Unique", func(assert QUnit.QUnitAssert) {

		jQuery(`<div>There are 6 divs in this document.</div>
				<div></div>
				<div class="dup"></div>
				<div class="dup"></div>
				<div class="dup"></div>
				<div></div>`).AppendTo(FIX)

		divs := jQuery(FIX).Find("div").Get()
		assert.Equal(divs.Get("length"), 6, "6 divs inserted")

		jQuery(FIX).Find(".dup").Clone(true).AppendTo(FIX)
		divs2 := jQuery(FIX).Find("div").Get()
		assert.Equal(divs2.Get("length"), 9, "9 divs inserted")

		divs3 := jquery.Unique(divs)
		assert.Equal(divs3.Get("length"), 6, "post-qunique should be 6 elements")
	})

	QUnit.Test("Serialize,SerializeArray,Trigger,Submit", func(assert QUnit.QUnitAssert) {

		QUnit.Expect(2)
		jQuery(`<form>
				  <div><input type="text" name="a" value="1" id="a"></div>
				  <div><input type="text" name="b" value="2" id="b"></div>
				  <div><input type="hidden" name="c" value="3" id="c"></div>
				  <div>
				    <textarea name="d" rows="8" cols="40">4</textarea>
				  </div>
				  <div><select name="e">
				    <option value="5" selected="selected">5</option>
				    <option value="6">6</option>
				    <option value="7">7</option>
				  </select></div>
				  <div>
				    <input type="checkbox" name="f" value="8" id="f">
				  </div>
				  <div>
				    <input type="submit" name="g" value="Submit" id="g">
				  </div>
				</form>`).AppendTo(FIX)

		var collectResults string
		jQuery(FIX).Find("form").Submit(func(evt jquery.Event) {

			sa := jQuery(evt.Target).SerializeArray()
			for i := 0; i < sa.Length(); i++ {
				collectResults += sa.Index(i).Get("name").String()
			}
			assert.Equal(collectResults, "abcde", "SerializeArray")
			evt.PreventDefault()
		})

		serializedString := "a=1&b=2&c=3&d=4&e=5"
		assert.Equal(jQuery(FIX).Find("form").Serialize(), serializedString, "Serialize")

		jQuery(FIX).Find("form").Trigger("submit")
	})

	QUnit.ModuleLifecycle("events", EvtScenario{})
	QUnit.Test("On,One,Off,Trigger", func(assert QUnit.QUnitAssert) {

		fn := func(ev jquery.Event) {
			assert.Ok(!ev.Data.IsUndefined(), "on() with data, check passed data exists")
			assert.Equal(ev.Data.Get("foo"), "bar", "on() with data, Check value of passed data")
		}

		data := map[string]interface{}{"foo": "bar"}
		jQuery("#firstp").On(jquery.CLICK, data, fn).Trigger(jquery.CLICK).Off(jquery.CLICK, fn)

		var clickCounter, mouseoverCounter int
		handler := func(ev jquery.Event) {
			if ev.Type == jquery.CLICK {
				clickCounter++
			} else if ev.Type == jquery.MOUSEOVER {
				mouseoverCounter++
			}
		}

		handlerWithData := func(ev jquery.Event) {
			if ev.Type == jquery.CLICK {
				clickCounter += ev.Data.Get("data").Int()
			} else if ev.Type == jquery.MOUSEOVER {
				mouseoverCounter += ev.Data.Get("data").Int()
			}
		}

		data2 := map[string]interface{}{"data": 2}
		elem := jQuery("#firstp").On(jquery.CLICK, handler).On(jquery.MOUSEOVER, handler).One(jquery.CLICK, data2, handlerWithData).One(jquery.MOUSEOVER, data2, handlerWithData)
		assert.Equal(clickCounter, 0, "clickCounter initialization ok")
		assert.Equal(mouseoverCounter, 0, "mouseoverCounter initialization ok")

		elem.Trigger(jquery.CLICK).Trigger(jquery.MOUSEOVER)
		assert.Equal(clickCounter, 3, "clickCounter Increased after Trigger/On/One")
		assert.Equal(mouseoverCounter, 3, "mouseoverCounter Increased after Trigger/On/One")

		elem.Trigger(jquery.CLICK).Trigger(jquery.MOUSEOVER)
		assert.Equal(clickCounter, 4, "clickCounter Increased after Trigger/On")
		assert.Equal(mouseoverCounter, 4, "a) mouseoverCounter Increased after TriggerOn")

		elem.Trigger(jquery.CLICK).Trigger(jquery.MOUSEOVER)
		assert.Equal(clickCounter, 5, "b) clickCounter not Increased after Off")
		assert.Equal(mouseoverCounter, 5, "c) mouseoverCounter not Increased after Off")

		elem.Off(jquery.CLICK).Off(jquery.MOUSEOVER)
		//2do: elem.Off(jquery.CLICK, handlerWithData).Off(jquery.MOUSEOVER, handlerWithData)
		elem.Trigger(jquery.CLICK).Trigger(jquery.MOUSEOVER)
		assert.Equal(clickCounter, 5, "clickCounter not Increased after Off")
		assert.Equal(mouseoverCounter, 5, "mouseoverCounter not Increased after Off")

	})
}
