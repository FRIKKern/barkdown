package main
import("encoding/json";"fmt";"os";"reader-notice-verifier/dirhash")
type Module struct { Path string; Version string; Directory string; Archive struct { PrivatePath string }; Sum string }
type Result struct { Path string; Version string; Expected string; ZipSum string; DirectorySum string; Error string }
func main(){b,e:=os.ReadFile(os.Args[1]);if e!=nil{panic(e)};var mods []Module;if e=json.Unmarshal(b,&mods);e!=nil{panic(e)};rows:=[]Result{};failed:=false;for _,m:=range mods{r:=Result{Path:m.Path,Version:m.Version,Expected:m.Sum};var z,d error;r.ZipSum,z=dirhash.HashZip(m.Archive.PrivatePath,dirhash.DefaultHash);r.DirectorySum,d=dirhash.HashDir(m.Directory,m.Path+"@"+m.Version,dirhash.DefaultHash);if z!=nil||d!=nil{r.Error=fmt.Sprint(z,"; ",d);failed=true};if r.ZipSum!=m.Sum||r.DirectorySum!=m.Sum{failed=true};rows=append(rows,r)};if e=json.NewEncoder(os.Stdout).Encode(rows);e!=nil{panic(e)};if failed{os.Exit(1)}}
