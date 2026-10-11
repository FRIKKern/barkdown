defmodule C098LifecycleProbe do
  def record(file, receipt) do
    File.write!(file <> ".next", :json.encode(receipt) |> IO.iodata_to_binary())
    File.rename!(file <> ".next", file)
  end
  def ack(data, name, nonce) do
    wait_file(Path.join(data, "ack-" <> name), nonce, System.monotonic_time(:millisecond) + 30000)
  end
  def wait_file(file, nonce, deadline) do
    case File.read(file) do
      {:ok, ^nonce} -> :ok
      _ ->
        if System.monotonic_time(:millisecond) >= deadline, do: raise("lifecycle observation deadline")
        Process.sleep(50)
        wait_file(file, nonce, deadline)
    end
  end
  def until(marker, deadline, text \\ "") do
    if String.contains?(text, marker), do: text, else: receive do
      {:data, _, bytes} -> until(marker, deadline, text <> bytes)
      {:exit, index, code, signal} -> raise "premature/duplicate exit #{inspect({index, code, signal})}"
    after max(1, deadline - System.monotonic_time(:millisecond)) -> raise "PTY output deadline" end
  end
  def exit_callback(index, timeout) do
    receive do
      {:exit, ^index, code, signal} -> %{received: true, code: code, signal: signal}
      {:exit, other, code, signal} -> raise "wrong/duplicate callback #{inspect({other, code, signal})}"
    after timeout -> raise "lifecycle callback deadline" end
  end
  def no_duplicate do
    receive do {:exit, index, code, signal} -> raise "duplicate callback #{inspect({index, code, signal})}" after 0 -> :ok end
  end
end
out=System.fetch_env!("C098_NIF_RESULT")
data=System.fetch_env!("C098_NIF_DATA")
nonce=System.fetch_env!("C098_NIF_NONCE")
candidate=System.fetch_env!("C098_CANDIDATE")
record=fn r -> C098LifecycleProbe.record(out,r) end
receipt=%{status: "running",beam_pid: String.to_integer(System.pid()),checks: [],children: [],lifecycle_accepted: false}
record.(receipt)
try do
  true=Code.prepend_path(Path.join(candidate,"ebin"))
  case Application.load(:expty) do :ok -> :ok; {:error,{:already_loaded,:expty}} -> :ok end
  {:module,ExPTY.Nif}=Code.ensure_loaded(ExPTY.Nif)
  {:module,ExPTY}=Code.ensure_loaded(ExPTY)
  true=function_exported?(ExPTY.Nif,:close,1)
  receipt=Map.merge(receipt,%{status: "measure",phase: "baseline",expty_priv: List.to_string(:code.priv_dir(:expty)),expty_module: List.to_string(:code.which(ExPTY.Nif))})
  record.(receipt)
  C098LifecycleProbe.ack(data,"baseline",nonce)
  parent=self()
  executable=System.fetch_env!("C098_NIF_POWERSHELL")
  keys=~w(PATH PATHEXT SystemRoot WINDIR ComSpec USERPROFILE APPDATA LOCALAPPDATA TEMP TMP PSModuleAnalysisCachePath)
  env=Enum.reduce(keys,%{},fn k,a -> case System.get_env(k) do nil -> a; v -> Map.put(a,k,v) end end)
  receipt=Enum.reduce(1..3,receipt,fn index,receipt ->
    child_nonce=nonce<>"-"<>Integer.to_string(index)
    child_env=Map.merge(env,%{"C098_NIF_CHILD_IDENTITY"=>Path.join(data,"child-identity-#{index}.json"),"C098_NIF_NONCE"=>child_nonce})
    {:ok,pty}=ExPTY.spawn(executable,["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",System.fetch_env!("C098_NIF_CHILD")],cwd: data,cols: 80,rows: 24,env: child_env,on_data: fn _,_,bytes -> send(parent,{:data,index,bytes}) end,on_exit: fn _,_,code,signal -> send(parent,{:exit,index,code,signal}) end)
    state=:sys.get_state(pty)
    true=is_reference(state.pty)
    wrong_owner=try do ExPTY.Nif.write(state.pty,"unowned"); :allowed rescue ArgumentError -> :refused end
    :refused=wrong_owner
    ready=C098LifecycleProbe.until("C098_CARRIED_READY:"<>child_nonce,System.monotonic_time(:millisecond)+15000)
    true=String.contains?(ready,child_nonce)
    child=%{index: index,pid: state.inner_pid,resource_reference: true,wrong_owner_refused: true,ready_nonce_seen: true}
    receipt=Map.merge(receipt,%{status: "waiting-child",phase: "child-#{index}",child: child})
    record.(receipt)
    C098LifecycleProbe.ack(data,"child-#{index}",nonce)
    :ok=ExPTY.resize(pty,112,34)
    :ok=ExPTY.write(pty,child_nonce<>"\r")
    readback=C098LifecycleProbe.until("C098_CARRIED_READ:"<>child_nonce,System.monotonic_time(:millisecond)+15000)
    _=C098LifecycleProbe.until("C098_CARRIED_SIZE:112:34",System.monotonic_time(:millisecond)+15000,readback)
    :ok=ExPTY.write(pty,"finish-"<>child_nonce<>"\r")
    callback=C098LifecycleProbe.exit_callback(index,5000)
    %{received: true,code: 23,signal: nil}=callback
    {:error,_}=ExPTY.write(pty,"closed")
    {:error,_}=ExPTY.write(pty,"closed-again")
    {:error,_}=ExPTY.resize(pty,80,24)
    child=Map.merge(child,%{callback: callback,input_readback: true,actual_geometry: [112,34],closed_operations_refused: true})
    receipt=Map.merge(receipt,%{status: "measure",phase: "exited-#{index}",child: child})
    record.(receipt)
    C098LifecycleProbe.ack(data,"exited-#{index}",nonce)
    :ok=GenServer.stop(pty)
    false=Process.alive?(pty)
    C098LifecycleProbe.no_duplicate()
    Map.put(receipt,:children,receipt.children++[Map.put(child,:pty_stopped,true)])
  end)
  record.(Map.merge(receipt,%{status: "measure",phase: "wrappers-stopped"}))
  C098LifecycleProbe.ack(data,"wrappers-stopped",nonce)
  C098LifecycleProbe.no_duplicate()
  record.(Map.merge(receipt,%{status: "component-observed",prototype_natural_exit_passed: true,lifecycle_accepted: false}))
rescue
  error -> record.(Map.merge(receipt,%{status: "failed",error: Exception.message(error)}));reraise error,__STACKTRACE__
end
