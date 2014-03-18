package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type Response map[string]interface{}

func (r Response) String() (s string) {
	b, err := json.Marshal(r)
	if err != nil {
		s = ""
		return
	}
	s = string(b)
	return
}

func myHandler(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("Content-Type", "application/json")
	fmt.Fprint(rw, Response{"success": true, "message": "Welcome!", "nested": Response{"moresuccess": true, "level": 1}})
	return
}

func main() {

	http.Handle("/test/", http.StripPrefix("/test/", http.FileServer(http.Dir("./test/"))))
	http.HandleFunc("/", myHandler)
	http.ListenAndServe(":3000", nil)
}
