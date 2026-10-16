# PRIVATE CANDIDATE ONLY; Apache-2.0 LICENSE retained; no production adoption.
# Known remaining gap: owner death after Content but before physical upgrade.
# PRIVATE OBSERVER ONLY; Apache-2.0 LICENSE retained. No source/release patch.
defmodule Barkpark.Media.Storage.Checkout do
  @moduledoc "Editorial checkout lock on `mediaAsset` documents."

  alias Barkpark.Content
  alias Barkpark.Content.Document
  alias Barkpark.Media.Storage.{Actor, MediaFile}

  @asset_type "mediaAsset"

  @doc "Check out an asset for editing. Returns updated document."
  @spec checkout(%MediaFile{}, Actor.t() | String.t(), String.t()) ::
          {:ok, Document.t()} | {:error, term()}
  # A bare label string is a token/system actor (tests, internal callers).
  def checkout(%MediaFile{} = file, actor, dataset) when is_binary(actor),
    do: checkout(file, %Actor{label: actor}, dataset)

  def checkout(%MediaFile{} = file, %Actor{} = actor, dataset) do
    with %Document{} = doc <- fetch_doc(file, dataset),
         :ok <- ensure_available(doc, actor) do
      # Stamps the actor's label, so a legacy email stamp the same account
      # held is rewritten to "user:<id>" here (task-36a302b2e981d5e1).
      patch_checkout(doc, file, dataset, actor.label, DateTime.utc_now() |> DateTime.to_iso8601())
    end
  end

  @doc """
  Release the checkout lock.

  `admin?` is the caller's force-release privilege as decided by the controller
  (`BarkparkWeb.V1.MediaController.admin?/1`), which is TRUE ADMIN ONLY as of
  felix-w28-bl-checkout-tighten-adjudication (ruled 2026-09-09). A write token
  arrives here with `admin? == false`, so the holder-only branch
  (`Actor.holds?/2`) of `ensure_can_release/3` is the LIVE API path for it — a
  write token releases only its own lock; releasing another actor's lock is an
  admin privilege. A force-release (actor -> nil) also drops the file's
  renditions — see `patch_checkout/5`.
  """
  @spec undo_checkout(%MediaFile{}, Actor.t() | String.t(), String.t(), boolean()) ::
          {:ok, Document.t()} | {:error, term()}
  def undo_checkout(%MediaFile{} = file, actor, dataset, admin?) when is_binary(actor),
    do: undo_checkout(file, %Actor{label: actor}, dataset, admin?)

  def undo_checkout(%MediaFile{} = file, %Actor{} = actor, dataset, admin?) do
    with %Document{} = doc <- fetch_doc(file, dataset),
         :ok <- ensure_can_release(doc, actor, admin?) do
      Barkpark.ManagedRuntime.WriteAdmission.Door.admit(fn ->
        patch_checkout(doc, file, dataset, nil, nil)
      end)
    end
  end

  defp fetch_doc(%MediaFile{} = file, dataset) do
    case Barkpark.Plugins.Media.Assets.find_by_media_file_id(
           file.id,
           dataset,
           MediaFile.scope_opts(file)
         ) do
      %Document{} = doc -> doc
      nil -> {:error, :not_found}
    end
  end

  defp ensure_available(%Document{content: content}, actor) do
    holder = Map.get(content || %{}, "checkedOutBy")

    cond do
      holder in [nil, ""] -> :ok
      Actor.holds?(actor, holder) -> :ok
      true -> {:error, :checked_out}
    end
  end

  defp ensure_can_release(%Document{content: content}, actor, admin?) do
    holder = Map.get(content || %{}, "checkedOutBy")

    cond do
      holder in [nil, ""] -> :ok
      admin? -> :ok
      Actor.holds?(actor, holder) -> :ok
      true -> {:error, :forbidden}
    end
  end

  defp patch_checkout(doc, file, dataset, actor, at) do
    content =
      (doc.content || %{})
      |> Map.put("checkedOutBy", actor)
      |> Map.put("checkedOutAt", at)

    attrs = %{
      "doc_id" => doc.doc_id,
      "title" => doc.title,
      "status" => doc.status,
      "content" => content
    }

    case Content.upsert_document(
           @asset_type,
           attrs,
           dataset,
           [source: :api] ++ MediaFile.scope_opts(file)
         ) do
      {:ok, updated} ->
        # Force-release side effect: clearing the holder (actor == nil, the
        # release path) drops the file's cached renditions so a re-edit
        # regenerates them from the current bytes rather than serving stale ones.
        cache_result = if actor == nil do
          hook = Application.get_env(:barkpark, :checkout_release_test_hook)
          if is_function(hook, 3), do: hook.(doc, file, updated)
          if Barkpark.ManagedRuntime.WriteAdmission.Door.enabled?() do
            # Private candidate: original address comes from the loaded MediaFile.
            key = case file.object_key do
              value when is_binary(value) and byte_size(value) > 0 -> value
              _ -> file.path
            end
            Barkpark.Media.Renditions.delete_for_file(file.id, key)
          else
            Barkpark.Media.Renditions.delete_for_file(file.id)
          end
        else
          :ok
        end
        case cache_result do
          :ok -> {:ok, updated}
          error -> error
        end

      error ->
        error
    end
  end
end
