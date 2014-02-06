package test

//test package for jquery
import (
	. "github.com/rusco/jquery"
	QUnit "github.com/rusco/qunit"
)

func main() {

	QUnit.Module("core")
	QUnit.Test("jQuery() Object", func(assert QUnit.QUnitAssert) {
		jQ := NewJQuery()
		assert.Equal(jQ.Jquery(), "2.1.0", "JQuery Version")
		assert.Equal(jQ.Length(), 0, "jQuery().Length()")
		assert.Equal(jQ.Size(), 0, "jQuery().Size()")

		jQ2 := NewJQuery("body")
		assert.Equal(jQ2.Selector(), "body", `jQuery("body").Selector()`)
	})

	QUnit.Module("dom")
	QUnit.Test("add", func(assert QUnit.QUnitAssert) {

		NewJQuery("p").AddClass("wow").Clone().Add("<span>Again</span>").AppendTo("body")
		txt := NewJQuery("p#qunit-testresult").NextBySelector("span").Text()
		print("txt = ", txt)
		assert.Equal(txt, "Again", `Clone, Add, AppendTo, Find, Text Functions`)

	})

}
