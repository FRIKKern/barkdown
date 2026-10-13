package main

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"go.yaml.in/yaml/v3"
)

func load(p string) map[string]any {
	b, err := os.ReadFile(p); if err != nil { panic(err) }
	var v map[string]any; if err := yaml.Unmarshal(b, &v); err != nil { panic(err) }
	return v
}
func same(a,b any) { if !reflect.DeepEqual(a,b) { panic("unchanged workflow contract differs") } }
func object(x any) map[string]any { return x.(map[string]any) }
func main() {
	a,b:=load(os.Args[1]),load(os.Args[2])
	for _,k:=range []string{"name","on","permissions","concurrency"} { same(a[k],b[k]) }
	aj,bj:=object(object(a["jobs"])["parity"]),object(object(b["jobs"])["parity"])
	for _,k:=range []string{"name","runs-on","timeout-minutes","services"} { same(aj[k],bj[k]) }
	as,bs:=aj["steps"].([]any),bj["steps"].([]any)
	if len(bs)!=len(as)-1 { panic("only the token guard step should be removed") }
	for i,x:=range bs {
		before,after:=object(as[i+1]),object(x)
		same(before["name"],after["name"]); same(before["uses"],after["uses"])
		if after["name"]=="Parity rows" { same(before["run"],after["run"]); same(before["env"],after["env"]) }
		if condition,exists:=after["if"]; exists { same(condition,"always()") }
	}
	with:=object(object(bs[1])["with"])
	same(with["repository"],"FRIKKern/barkdown"); same(with["token"],"${{ github.token }}")
	v:=map[string]any{"yamlParsed":true,"stepsBefore":len(as),"stepsAfter":len(bs),"unchangedTriggersAndPermissions":true,"rowCommandAndSelectionUnchanged":true,"workflowAdopted":false}
	bjson,_:=json.Marshal(v);fmt.Println(string(bjson))
}
